const XLSX = require('xlsx');
const path = require('path');

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Define the headers
const headers = [
  'Company Name',
  'Email Address',
  'Phone Number',
  'Full Name',
  'Company Address'
];

// Define sample data rows
const sampleData = [
  ['ABC Corporation', 'contact@abc.com', '9876543210', 'John Doe', '123 Business Street, Mumbai, Maharashtra'],
  ['XYZ Ltd', 'info@xyz.com', '9876543211', 'Jane Smith', '456 Commerce Road, Delhi, India'],
  ['Tech Solutions Inc', 'sales@techsolutions.com', '9876543212', 'Mike Johnson', '789 Innovation Park, Bangalore, Karnataka']
];

// Combine headers with sample data
const worksheetData = [headers, ...sampleData];

// Create worksheet
const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

// Set column widths
worksheet['!cols'] = [
  { wch: 25 }, // Company Name
  { wch: 30 }, // Email Address
  { wch: 15 }, // Phone Number
  { wch: 20 }, // Full Name
  { wch: 50 }  // Company Address
];

// Add the worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

// Write the file
const outputPath = path.join(__dirname, '../public/customer-import-template.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log('✓ Customer import template created successfully!');
console.log(`  Location: ${outputPath}`);
console.log('\nTemplate includes:');
console.log('  - Header row with column names');
console.log('  - 3 sample data rows');
console.log('\nYou can now download this template from /customer-import-template.xlsx');
