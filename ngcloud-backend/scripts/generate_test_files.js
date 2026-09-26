const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = path.join(__dirname, '../../test_files');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// 1. TXT
fs.writeFileSync(path.join(dir, 'doc_txt.txt'), 'Hello, this is a secure text file containing functional test data for NGCloud zero-knowledge system.');

// 2. PDF (mock PDF structure)
const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 48 >>\nstream\nBT /F1 12 Tf 70 700 Td (NGCloud Secure PDF Document) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n311\n%%EOF`;
fs.writeFileSync(path.join(dir, 'doc_pdf.pdf'), pdfContent);

// 3. PNG (1x1 transparent PNG)
const pngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
fs.writeFileSync(path.join(dir, 'image_png.png'), pngBytes);

// 4. JPG (minimal 1x1 black JPG)
const jpgBytes = Buffer.from('ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c3031343434ffd9', 'hex');
fs.writeFileSync(path.join(dir, 'image_jpg.jpg'), jpgBytes);

// 5. ZIP (minimal empty zip file)
const zipBytes = Buffer.from('504b0506000000000000000000000000000000000000', 'hex');
fs.writeFileSync(path.join(dir, 'archive_zip.zip'), zipBytes);

// 6. DOCX (mock docx - zip structure or plain file)
fs.writeFileSync(path.join(dir, 'doc_docx.docx'), 'PK\x03\x04Mock DOCX Word Document');

// 7. XLSX (mock xlsx)
fs.writeFileSync(path.join(dir, 'doc_xlsx.xlsx'), 'PK\x03\x04Mock XLSX Spreadsheet');

// 8. PPTX (mock pptx)
fs.writeFileSync(path.join(dir, 'doc_pptx.pptx'), 'PK\x03\x04Mock PPTX Presentation');

// 9. BIN (random binary file, 5KB)
const randomBytes = crypto.randomBytes(5000);
fs.writeFileSync(path.join(dir, 'binary_random.bin'), randomBytes);

console.log('✓ All functional test files generated successfully in: ' + path.resolve(dir));
