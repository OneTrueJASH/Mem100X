#!/usr/bin/env node

// Test to find exact position 135 issue

const msg = '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_entities","arguments":{"entities":[{"name":"test-entity","entityType":"test","observations":["Test observation"]}]}},"id":2}';

console.log('Message:', msg);
console.log('Length:', msg.length);
console.log('Char at 135:', msg[135], 'Code:', msg.charCodeAt(135));
console.log('Around 135:', msg.substring(130, 145));

// Check if adding newline changes position
const msgWithNewline = msg + '\n';
console.log('\nWith newline length:', msgWithNewline.length);
console.log('Char at 135:', msgWithNewline[135], 'Code:', msgWithNewline.charCodeAt(135));