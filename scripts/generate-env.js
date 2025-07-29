#!/usr/bin/env node

/**
 * Mem100x Environment File Generator
 * Generates a fully populated .env file with all default values
 */

import { generateEnvFile } from '../dist/config.js';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function printUsage() {
  console.log(`
Mem100x Environment File Generator

Usage:
  node scripts/generate-env.js [options]

Options:
  --print-defaults    Print the default configuration to stdout
  --output <file>     Write the configuration to a specific file (default: .env)
  --help, -h          Show this help message

Examples:
  # Print defaults to stdout
  node scripts/generate-env.js --print-defaults

  # Generate .env file in current directory
  node scripts/generate-env.js

  # Generate custom config file
  node scripts/generate-env.js --output my-config.env

  # Generate and show the content
  node scripts/generate-env.js --print-defaults > .env
`);
}

function main() {
  const args = process.argv.slice(2);
  let printDefaults = false;
  let outputFile = '.env';

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--print-defaults':
        printDefaults = true;
        break;
      case '--output':
        if (i + 1 < args.length) {
          outputFile = args[++i];
        } else {
          console.error('Error: --output requires a filename');
          process.exit(1);
        }
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown option '${arg}'`);
        printUsage();
        process.exit(1);
    }
  }

  try {
    // Generate the environment file content
    const envContent = generateEnvFile();

    if (printDefaults) {
      // Print to stdout
      console.log(envContent);
    } else {
      // Write to file
      const fullPath = join(process.cwd(), outputFile);

      if (existsSync(fullPath)) {
        console.log(`⚠️  Warning: File '${outputFile}' already exists.`);
        console.log(`   The file will be overwritten.`);
        console.log(`   Use --print-defaults to preview the content first.`);
      }

      writeFileSync(fullPath, envContent, 'utf8');
      console.log(`✅ Generated environment file: ${outputFile}`);
      console.log(`📝 Edit this file to customize your Mem100x configuration.`);
      console.log(`🔧 See CONFIGURATION.md for detailed configuration options.`);
    }
  } catch (error) {
    console.error('❌ Error generating environment file:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
