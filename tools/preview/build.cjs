const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");
const root = __dirname;
const repo = path.resolve(root, "../..");
const modules = path.join(repo, "mobile/node_modules");
const screens = path.join(repo, "mobile/src");
const mocks = new Set(
  ["api", "storage", "google", "reminders", "uploads"].map((x) =>
    path.join(screens, "lib", x),
  ),
);
(async () => {
  const result = await esbuild.build({
    plugins: [
      {
        name: "local-preview",
        setup(build) {
          build.onResolve({ filter: /^\./ }, (args) => {
            const resolved = path.resolve(
              path.dirname(args.importer),
              args.path,
            );
            if (mocks.has(resolved))
              return { path: path.join(root, "mock.ts") };
          });
        },
      },
    ],
    entryPoints: [path.join(root, "entry.tsx")],
    bundle: true,
    minify: true,
    write: false,
    platform: "browser",
    format: "iife",
    mainFields: ["module", "main"],
    resolveExtensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ],
    define: {
      "process.env.NODE_ENV": '"production"',
      __DEV__: "false",
      global: "globalThis",
    },
    alias: {
      react: path.join(root, "node_modules/react"),
      "react-dom": path.join(root, "node_modules/react-dom"),
      "react-native": path.join(root, "native.ts"),
      "expo-crypto": path.join(root, "crypto.ts"),
      "react-native-svg": path.join(
        modules,
        "react-native-svg/lib/module/ReactNativeSVG.web.js",
      ),
      "lucide-react-native": path.join(modules, "lucide-react-native"),
    },
    nodePaths: [path.join(root, "node_modules"), modules],
  });
  const shell = fs.readFileSync(path.join(root, "shell.html"), "utf8");
  const fragment =
    shell +
    "\n<script>\n" +
    result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script") +
    "\n</script>\n";
  if (Buffer.byteLength(fragment) > 1000000)
    throw new Error("Preview exceeds 1 MB");
  const target = process.argv[2] || path.join(repo, "docs/design-preview.html");
  fs.writeFileSync(target, fragment);
  console.log(
    `Built 12-screen preview: ${Buffer.byteLength(fragment)} bytes → ${target}`,
  );
})();
