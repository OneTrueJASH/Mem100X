# DEVELOPMENT.md

## Project Structure

- **Source code:** `src/`
- **Compiled output:** `dist/`
- **Tests:** `test/` (TypeScript, ESM)

## Build & Clean

- **Clean build artifacts:**
  ```sh
  npm run clean
  ```
  (Removes the `dist/` directory)

- **Build the project:**
  ```sh
  npm run build
  ```
  (Cleans and compiles TypeScript to `dist/`)

## Running the Server (Dev)

- **Development mode:**
  ```sh
  npm run dev
  ```
  (Runs `src/server-multi.ts` with hot reload via `tsx`)

- **Production mode:**
  ```sh
  npm start
  ```
  (Runs compiled `dist/server-multi.js`)

## Testing

- **Test location:** All tests should be placed in the `test/` directory. Example: `test/test-privacy-security.ts`
- **Test framework:** [Vitest](https://vitest.dev/) is configured, but you can also run standalone TypeScript test files.

### Running All Tests (Vitest)

```sh
npm test
```

### Running a Standalone TypeScript Test

If you have a test file like `test/test-privacy-security.ts` that uses ESM and TypeScript, you can run it directly with:

```sh
node --loader tsx test/test-privacy-security.ts
```

Or, if you want to run all tests in the `test/` directory with Vitest:

```sh
npx vitest run
```

## Notes

- The project uses ESM (`"type": "module"` in `package.json`). Use `import`/`export` syntax.
- Always import from the correct path (e.g., `../src/utils/privacy-security.js` in tests).
- Clean before building to avoid stale artifacts.
- For new tests, prefer TypeScript and place them in `test/`.

---

For more details, see `README.md` or open an issue if you have questions. 
