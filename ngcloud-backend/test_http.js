async function test() {
  const baseURL = 'http://localhost:5000';
  const username = 'testuser_' + Math.floor(Math.random() * 1000000);
  const password = 'P@ssword123!';

  console.log('1. Registering user:', username);
  let res = await fetch(`${baseURL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Register failed: ' + await res.text());

  console.log('2. Logging in...');
  res = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Login failed: ' + await res.text());
  const loginRes = await res.json();
  const token = loginRes.token || loginRes.accessToken;
  console.log('Token received');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('3. Generating upload URL...');
  res = await fetch(`${baseURL}/api/files/upload-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filename: 'test_file.txt',
      totalChunks: 2,
      size: 100
    })
  });
  if (!res.ok) throw new Error('Upload URL failed: ' + await res.text());
  const uploadRes = await res.json();
  console.log('File ID:', uploadRes.fileId);
  const fileId = uploadRes.fileId;

  console.log('4. Saving file chunks...');
  res = await fetch(`${baseURL}/api/files/${fileId}/chunks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chunks: [
        { chunkIndex: 0, minioPath: 'test/path/part0', chunkHash: 'hash0', chunkSize: 50 },
        { chunkIndex: 1, minioPath: 'test/path/part1', chunkHash: 'hash1', chunkSize: 50 }
      ]
    })
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}

test().catch(console.error);
