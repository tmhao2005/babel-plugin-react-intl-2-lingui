import { declare } from "@babel/helper-plugin-utils";
import { PluginObj, types as t } from "@babel/core";
import { NodePath } from "@babel/traverse";

export default declare((api: any) => {
  api.assertVersion(7);

  const LINGUI_MODULE = "@lingui/react";
  const REACT_INTL_MODULE = "react-intl";

  const moduleMap = new Map([[REACT_INTL_MODULE, LINGUI_MODULE]]);
  const componentMap = new Map([
    ["FormattedMessage", "Trans"],
    ["FormattedHTMLMessage", "Trans"],
    ["defineMessages", ""],
  ]);
  const attributeMap = new Map([["defaultMessage", "defaults"]]);

  function isTranslationImport(path: NodePath<t.Statement>): boolean {
    return path.isImportDeclaration() && moduleMap.has(path.node.source.value);
  }

  function checkIfReactIntlInstalled(
    importPath: NodePath<t.ImportDeclaration>,
    file: any
  ) {
    const unsupportedImports = [];
    const addedNames = new Map();

    const replacedSpecifiers = importPath
      .get("specifiers")
      .reduce((list, elem) => {
        if (elem.isImportSpecifier()) {
          const name = componentMap.get(elem.node.imported.name);

          if (typeof name !== "undefined") {
            if (name && !addedNames.has(name)) {
              addedNames.set(name, elem);

              list.push(
                t.importSpecifier(t.identifier(name), t.identifier(name))
              );
            }
          } else {
            unsupportedImports.push(elem.node.imported.name);
          }
        } else {
          throw importPath.buildCodeFrameError(
            "Just only support named import for now"
          );
        }

        return list;
      }, []);

    if (unsupportedImports.length) {
      console.warn(
        "Skipping this file due to still using unsupported methods: %s at line %s > %s",
        unsupportedImports.join(","),
        importPath.node.source.start,
        file.opts.filename
      );
      return;
    }

    return [importPath, replacedSpecifiers];
  }

  function isReactIntlComponent(path: NodePath<t.JSXOpeningElement>): boolean {
    const name = path.get("name");

    // case of namespace import? <intl.FormattedMessage />
    //  but I yet support the namespace import, meaning this is unused for now
    if (name.isJSXMemberExpression()) {
      const object = name.get("object") as NodePath<t.JSXIdentifier>;
      const binding = object.scope.getBinding(object.node.name);

      if (binding) {
        const parentBinding = binding.path.parentPath;
        if (
          parentBinding.isImportDeclaration() &&
          parentBinding.get("source").node.value === REACT_INTL_MODULE
        ) {
          return true;
        }
      }
      return false;
    }

    return (
      t.isJSXIdentifier(path.node.name) &&
      isReferencedToReactIntlModule(path.get("name"))
    );
  }

  function isReferencedToReactIntlModule(path: NodePath): boolean {
    return Array.from(componentMap.keys()).some((item) =>
      path.referencesImport(REACT_INTL_MODULE, item)
    );
  }

  function buildJsxAttribute(name: string, value: string) {
    return t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value));
  }

  function replaceAttributes(
    jsxOpeningElementPath: NodePath<t.JSXOpeningElement>
  ) {
    const processAttributes = () => {
      const replaceValuePairKeys = new Map([["id", "defaultMessage"]]);
      const setKeys = new Set([
        ...replaceValuePairKeys.keys(),
        ...replaceValuePairKeys.values(),
      ]);
      const db = new Map<string, NodePath<t.JSXAttribute>>();

      jsxOpeningElementPath.get("attributes").forEach((item) => {
        if (item.isJSXAttribute()) {
          const name = item.get("name");

          if (name.isJSXIdentifier()) {
            if (setKeys.has(name.node.name)) {
              db.set(name.node.name, item);
            }

            if (attributeMap.has(name.node.name)) {
              item.node.name = t.jsxIdentifier(
                attributeMap.get(name.node.name)!
              );
            }
          }
        } else if (item.isJSXSpreadAttribute()) {
          const argument = item.get("argument");

          // use case: {...messages.foo}
          if (argument.isMemberExpression()) {
            const propertyPath = argument.get("property") as NodePath;
            const object = argument.get("object");
            const parsed = object.evaluate();

            if (parsed.confident) {
              if (propertyPath.isIdentifier()) {
                const value = parsed.value[propertyPath.node.name];

                item.replaceWithMultiple([
                  buildJsxAttribute("id", value.id),
                  buildJsxAttribute("defaults", value.defaultMessage),
                ]);
              }
            } else {
              throw new Error("We can't parse your message. Please check again");
            }
          }
        }
      });

      for (const [k, v] of replaceValuePairKeys) {
        const key = db.get(k);
        const value = db.get(v);

        if (key && value) {
          key.get("value").replaceWith(value.get("value"));
        }
      }
    };

    if (t.isJSXIdentifier(jsxOpeningElementPath.node.name)) {
      const linguiName = jsxOpeningElementPath.node.name.name;
      jsxOpeningElementPath.node.name.name = componentMap.get(linguiName)!;

      processAttributes();
    } else {
      const name = jsxOpeningElementPath.get("name");

      if (name.isJSXMemberExpression()) {
        const object = name.get("object") as NodePath<t.JSXIdentifier>;
        const property = name.get("property");
        object.node.name = "react-intl";
        property.node.name = componentMap.get(property.node.name)!;

        processAttributes();
      }
    }
  }

  return {
    visitor: {
      Program: {
        enter(path, { file }) {
          const replacedImports = [];
          const lingImports: NodePath<t.ImportDeclaration>[] = [];
          const intlImports: NodePath<t.ImportDeclaration>[] = [];

          path.get("body").forEach((statement) => {
            if (statement.isImportDeclaration()) {
              if (isTranslationImport(statement)) {
                const result = checkIfReactIntlInstalled(
                  statement as NodePath<t.ImportDeclaration>,
                  file
                );

                if (result) {
                  replacedImports.push(result);
                  intlImports.push(statement);
                }
              } else {
                if (statement.node.source.value === LINGUI_MODULE) {
                  lingImports.push(statement);
                }
              }
            }
          });

          if (!replacedImports.length) {
            return;
          }

          if (intlImports.length > 1) {
            throw Error(
              `This plugin currently don't support multiple import from "react-intl" for now`
            );
          }

          // both FormattedMessage and Trans get imported
          // so we remove one
          if (lingImports.length > 0 && intlImports.length === 1) {
            const linguiSpecifiers = [];

            lingImports[0].get("specifiers").forEach((lSpecifier) => {
              intlImports.forEach((intlImport) => {
                const duplicated = intlImport
                  .get("specifiers")
                  .some(
                    (rSpecifier) =>
                      rSpecifier.node.local.name === lSpecifier.node.local.name
                  );

                if (!duplicated) {
                  linguiSpecifiers.push(lSpecifier);
                }
              });
            });

            intlImports[0].get("specifiers").concat(linguiSpecifiers);

            for (const item of lingImports) {
              item.remove();
            }
          }

          path.traverse({
            VariableDeclarator(variableDeclaratorPath) {
              const initPath = variableDeclaratorPath.get("init");
              if (initPath.isCallExpression()) {
                const callee = initPath.get("callee");

                if (
                  callee.isIdentifier() &&
                  callee.referencesImport(REACT_INTL_MODULE, "defineMessages")
                ) {
                  initPath.replaceWith(initPath.get("arguments")[0]);
                }
              }
            },

            JSXElement(jsxElementPath) {
              const jsxOpenElementImportPath = jsxElementPath.get(
                "openingElement"
              );
              if (isReactIntlComponent(jsxOpenElementImportPath)) {
                replaceAttributes(jsxOpenElementImportPath);
              }
            },
          });

          // At the end, replace the import
          for (const [importPath, replacedSpecifiers] of replacedImports) {
            importPath.node.specifiers = replacedSpecifiers;
            importPath
              .get("source")
              .replaceWith(t.stringLiteral(LINGUI_MODULE));
          }
        },
      },
    },
  } as PluginObj<any>;
});
