import { transformFileSync } from "@babel/core";
import * as fs from "fs";
import { join } from "path";
import plugin from "../src";

function trim(str?: string | null) {
  return String(str).replace(/^\s+|\s+$/, "");
}

const fixturesDir = join(__dirname, "fixtures");
const localeDir = join(__dirname, "_build/test/fixtures");

describe("fixtures", () => {
  fs.readdirSync(fixturesDir).map((caseName) => {
    // if (caseName !== 'macro-plural') return;

    it(`output match: ${caseName}`, () => {
      const fixtureDir = join(fixturesDir, caseName);
      const messagePath = join(localeDir, caseName, "actual.js.json");

      if (fs.existsSync(messagePath)) {
        fs.unlinkSync(messagePath);
      }

      const { code: actual } = transform(join(fixtureDir, "actual.js"));

      expect(trim(actual)).toMatchSnapshot();
      expect(require(messagePath)).toMatchSnapshot();
    });
  });
});

const BASE_OPTIONS = {
  localeDir: __dirname,
};

let cacheBust = 1;

function transform(filePath: string, options = {}) {
  function getPluginConfig() {
    return [
      require("@lingui/babel-plugin-extract-messages"),
      {
        ...BASE_OPTIONS,
        ...options,
      },
      Date.now() + "" + ++cacheBust,
    ];
  }

  return transformFileSync(filePath, {
    presets: ["@babel/preset-env", "@babel/preset-react"],
    plugins: [plugin, "babel-plugin-macros", getPluginConfig()],
  });
}
