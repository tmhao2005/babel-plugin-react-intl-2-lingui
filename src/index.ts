import { declare } from '@babel/helper-plugin-utils';
import { PluginObj, types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';

export default declare((api: any) => {
  api.assertVersion(7);

  const LINGUI_MODULE = '@lingui/react';
  const REACT_INTL_MODULE = 'react-intl';

  const moduleMap = new Map([[REACT_INTL_MODULE, LINGUI_MODULE]]);
  const componentMap = new Map([['FormattedMessage', 'Trans'], ['FormattedHTMLMessage', 'Trans']]);
  const attributeMap = new Map([['defaultMessage', 'defaults']]);

  function isTranslationImport(path: NodePath<t.Statement>): boolean {
    return path.isImportDeclaration() && moduleMap.has(path.node.source.value);
  }

  function replaceTranslationModule(importPath: NodePath<t.ImportDeclaration>, file: any) {
    const unsupportedImports = [];
    const addedNames = new Map();

    const specifiers = importPath.get('specifiers').reduce((list, elem) => {
      if (elem.isImportSpecifier()) {
        const name = componentMap.get(elem.node.imported.name);

        if (name) {
          if (!addedNames.has(name)) {
            addedNames.set(name, elem);
            list.push(t.importSpecifier(t.identifier(name), t.identifier(name)));
          }
        } else {
          unsupportedImports.push(elem.node.imported.name);
        }
      } else {
        throw Error('Just only support named import for now');
      }

      return list;

    }, []);

    if (unsupportedImports.length) {
      console.warn(
        'Skipping this file due to still using unsupported methods: %s at line %s > %s',
        unsupportedImports.join(','),
        importPath.node.source.start,
        file.opts.filename
      );
      return false;
    }

    importPath.node.specifiers = specifiers;

    // importPath.get('specifiers').forEach(elem => {
    //   elem.scope.registerBinding('module', elem);
    // });

    importPath.get('source').replaceWith(t.stringLiteral(LINGUI_MODULE));

    return true;
  }

  function isTranslationComponent(path: NodePath<t.JSXOpeningElement>): boolean {
    const name = path.get('name');

    if (name.isJSXMemberExpression()) {
      const object = name.get('object') as NodePath<t.JSXIdentifier>;
      const binding = object.scope.getBinding(object.node.name);
      if (binding) {
        const parentBinding = binding.path.parentPath;
        if (parentBinding.isImportDeclaration() && parentBinding.get('source').node.value === REACT_INTL_MODULE) {
          return true;
        }
      }
      return false;
    }

    return t.isJSXIdentifier(path.node.name) && isReferencedToReactIntlModule(path.get('name'));
  }

  function isReferencedToReactIntlModule(path: NodePath): boolean {
    // console.log(path.referencesImport(LINGUI_MODULE, 'FormattedMessage'));
    return Array.from(componentMap.keys()).some(k => path.referencesImport(LINGUI_MODULE, k));
  }

  function replaceTranslationJSXAttributes(jsxOpeningElementPath: NodePath<t.JSXOpeningElement>) {
    const processAttributes = () => {
      const replaceValuePairKeys = new Map([
        ['id', 'defaultMessage'],
      ]);
      const setKeys = new Set([
        ...replaceValuePairKeys.keys(),
        ...replaceValuePairKeys.values(),
      ]);
      const db = new Map<string, NodePath<t.JSXAttribute>>();

      jsxOpeningElementPath.get('attributes').forEach(item => {
        if (item.isJSXAttribute()) {
          const name = item.get('name');

          if (name.isJSXIdentifier()) {
            if (setKeys.has(name.node.name)) {
              db.set(name.node.name, item);
            }

            if (attributeMap.has(name.node.name)) {
              item.node.name = t.jsxIdentifier(attributeMap.get(name.node.name)!);
            }
          }
        }
      });

      for (let [k, v] of replaceValuePairKeys) {
        const key = db.get(k);
        const value = db.get(v);

        if (key && value) {
          key.get('value').replaceWith(value.get('value'));
        }
      }
    };

    if (t.isJSXIdentifier(jsxOpeningElementPath.node.name)) {
      const linguiName = jsxOpeningElementPath.node.name.name;
      jsxOpeningElementPath.node.name.name = componentMap.get(linguiName)!;

      processAttributes();
    } else {
      const name = jsxOpeningElementPath.get('name');
      
      if (name.isJSXMemberExpression()) {
        const object = name.get('object') as NodePath<t.JSXIdentifier>;
        const property = name.get('property');
        object.node.name = 'react-intl';
        property.node.name = componentMap.get(property.node.name)!;

        processAttributes();
      }
    }
  }

  let hasTrans: boolean;
  let didExit: boolean;

  return {
    visitor: {
      Program: {
        enter(path, { file }) {
          const lingImports: Array<NodePath<t.ImportDeclaration>> = [];
          const intlImports: Array<NodePath<t.ImportDeclaration>> = [];

          path.get('body').forEach(statement => {
            if (statement.isImportDeclaration()) {
              if (isTranslationImport(statement)) {
                hasTrans = true;
                const status = replaceTranslationModule(statement as NodePath<t.ImportDeclaration>, file);

                if (status) {
                  intlImports.push(statement);
                }
              } else {
                if (statement.node.source.value === LINGUI_MODULE) {
                  lingImports.push(statement);
                }
              }
            }
          });

          if (intlImports.length > 1) {
            throw Error(`This plugin currently don't support multiple import from "react-intl" for now`);
          }

          // both FormattedMessage and Trans get imported
          // so we remove one
          if (lingImports.length > 0 && intlImports.length === 1) {
            const linguiSpecifiers = [];

            lingImports[0].get('specifiers').forEach(lSpecifier => {
              intlImports.forEach(intlImport => {
                const duplicated = intlImport.get('specifiers').some(rSpecifier => rSpecifier.node.local.name === lSpecifier.node.local.name);

                if (!duplicated) {
                  linguiSpecifiers.push(lSpecifier);
                }
              });
            });

            intlImports[0].get('specifiers').concat(linguiSpecifiers);

            for (const item of lingImports) {
              item.remove();
            }
          }
        },
        exit() {
          didExit = true;
        }
      },

      JSXElement(jsxElementPath) {
        if (!hasTrans) {
          return;
        }

        const jsxOpenElementImportPath = jsxElementPath.get('openingElement');
        if (isTranslationComponent(jsxOpenElementImportPath)) {
          replaceTranslationJSXAttributes(jsxOpenElementImportPath);
        }
      },
    },
  } as PluginObj<any>;
});
