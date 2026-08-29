import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * `eslint-config-next` v15 ships classic (eslintrc) configs rather than the flat
 * configs v16 exposes as ESM subpaths, so they are bridged with FlatCompat. Importing
 * `eslint-config-next/core-web-vitals` directly is a v16 idiom and fails here.
 */
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      /**
       * Cover images are arbitrary third-party URLs typed in by an instructor, because
       * the project deliberately has no upload pipeline — Railway's filesystem is
       * ephemeral, so uploads would need S3 or Cloudinary for no marks. `next/image`
       * requires every remote host to be allow-listed in next.config, which is
       * impossible for URLs that are user input. A plain `<img>` is the correct tool
       * here, so the rule is off rather than suppressed line by line.
       */
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
