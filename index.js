require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const BUCKET = process.env.AWS_S3_BUCKET;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function getPublicUrl(key) {
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// Home page
app.get("/", async (req, res) => {
  try {
    const result = await s3
      .listObjectsV2({ Bucket: BUCKET, Prefix: "apks/" })
      .promise();

    let rows = "";
    if (result.Contents && result.Contents.length > 0) {
      rows = result.Contents.map((item, idx) => {
        const url = getPublicUrl(item.Key);
        const sizeMB = (item.Size / (1024 * 1024)).toFixed(2);
        const lastModified = new Date(item.LastModified).toLocaleString();

        return `
          <tr class="bg-white border-b hover:bg-gray-50">
            <td class="px-6 py-4">${idx + 1}</td>
            <td class="px-6 py-4 font-medium text-gray-800">${item.Key}</td>
            <td class="px-6 py-4">${sizeMB} MB</td>
            <td class="px-6 py-4">${lastModified}</td>
            <td class="px-6 py-4 space-x-2">
              <button onclick="copyLink('${url}')" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition">Copy Link</button>
              <a href="${url}" target="_blank" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition">Download</a>
            </td>
            <td class="px-6 py-4">
              <form onsubmit="return handleDelete(this)">
                <input type="hidden" name="key" value="${item.Key}" />
                <button type="submit" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition flex items-center">
                  <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white hidden delete-spinner" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Delete
                </button>
              </form>
            </td>
            <td class="px-6 py-4">
              <form onsubmit="return handleUpdate(this)" class="flex items-center space-x-2">
                <input type="hidden" name="key" value="${item.Key}" />
                <input type="file" name="file" accept=".apk" required class="border rounded px-2 py-1"/>
                <button type="submit" class="bg-yellow-400 text-gray-800 px-3 py-1 rounded hover:bg-yellow-500 transition flex items-center">
                  <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-800 hidden update-spinner" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Update
                </button>
              </form>
            </td>
          </tr>
        `;
      }).join("");
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>APK Manager Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          function copyLink(url){
            navigator.clipboard.writeText(url)
              .then(()=> alert('Link copied!'))
              .catch(err => alert('Failed to copy: ' + err));
          }

          // Show loader
          function showLoader(message = 'Processing...') {
            const loader = document.getElementById('loader');
            const loaderText = document.getElementById('loader-text');
            loaderText.textContent = message;
            loader.classList.remove('hidden');
          }

          // Hide loader
          function hideLoader() {
            document.getElementById('loader').classList.add('hidden');
          }

          // Handle upload
          function handleUpload(form) {
            const fileInput = form.querySelector('input[type="file"]');
            if (!fileInput.files[0]) {
              alert('Please select a file');
              return false;
            }

            showLoader('Uploading APK...');

            const formData = new FormData(form);
            const xhr = new XMLHttpRequest();

            xhr.addEventListener('load', function() {
              if (xhr.status === 200 || xhr.status === 302) {
                setTimeout(() => {
                  hideLoader();
                  window.location.reload();
                }, 500);
              } else {
                hideLoader();
                alert('Upload failed: ' + xhr.responseText);
              }
            });

            xhr.addEventListener('error', function() {
              hideLoader();
              alert('Upload failed due to network error');
            });

            xhr.addEventListener('abort', function() {
              hideLoader();
              alert('Upload was cancelled');
            });

            xhr.timeout = 300000; // 5 minutes timeout
            xhr.addEventListener('timeout', function() {
              hideLoader();
              alert('Upload timed out. Please try again.');
            });

            xhr.open('POST', '/upload');
            xhr.send(formData);
            return false;
          }

          // Handle update
          function handleUpdate(form) {
            const fileInput = form.querySelector('input[type="file"]');
            if (!fileInput.files[0]) {
              alert('Please select a file to update');
              return false;
            }

            showLoader('Updating APK...');

            const formData = new FormData(form);
            const xhr = new XMLHttpRequest();

            xhr.addEventListener('load', function() {
              if (xhr.status === 200 || xhr.status === 302) {
                setTimeout(() => {
                  hideLoader();
                  window.location.reload();
                }, 500);
              } else {
                hideLoader();
                alert('Update failed: ' + xhr.responseText);
              }
            });

            xhr.addEventListener('error', function() {
              hideLoader();
              alert('Update failed due to network error');
            });

            xhr.addEventListener('abort', function() {
              hideLoader();
              alert('Update was cancelled');
            });

            xhr.timeout = 300000; // 5 minutes timeout
            xhr.addEventListener('timeout', function() {
              hideLoader();
              alert('Update timed out. Please try again.');
            });

            xhr.open('POST', '/update');
            xhr.send(formData);
            return false;
          }

          // Handle delete
          function handleDelete(form) {
            if (!confirm('Are you sure you want to delete this APK?')) {
              return false;
            }

            showLoader('Deleting APK...');
            
            const formData = new FormData(form);
            const xhr = new XMLHttpRequest();

            xhr.addEventListener('load', function() {
              if (xhr.status === 200 || xhr.status === 302) {
                setTimeout(() => {
                  hideLoader();
                  window.location.reload();
                }, 500);
              } else {
                hideLoader();
                alert('Delete failed: ' + xhr.responseText);
              }
            });

            xhr.addEventListener('error', function() {
              hideLoader();
              alert('Delete failed due to network error');
            });

            xhr.open('POST', '/delete');
            xhr.send(formData);
            return false;
          }
        </script>
      </head>
      <body class="bg-gray-100 min-h-screen">
        <!-- Loader Overlay -->
        <div id="loader" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white p-6 rounded-lg shadow-lg text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p id="loader-text" class="text-lg font-medium text-gray-700">Processing...</p>
          </div>
        </div>

        <div class="container mx-auto p-6">
          <h1 class="text-3xl font-bold text-center mb-6 text-gray-800">APK Management Portal</h1>

          <div class="bg-white p-6 rounded shadow mb-6">
            <h2 class="text-xl font-semibold mb-4">Upload New APK</h2>
            <form onsubmit="return handleUpload(this)" class="flex items-center space-x-4">
              <input type="file" name="file" accept=".apk" required class="border rounded px-3 py-2 w-full"/>
              <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white hidden" id="upload-spinner" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Upload
              </button>
            </form>
          </div>

          <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-semibold mb-4">Uploaded APKs</h2>
            ${rows ? `
            <div class="overflow-x-auto">
            <table class="min-w-full text-sm divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">#</th>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">File Name</th>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">Size</th>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">Last Modified</th>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">Link</th>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">Delete</th>
                  <th class="px-6 py-3 text-left font-medium text-gray-700">Update</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            </div>
            ` : '<p class="text-center text-gray-500">No APKs uploaded yet.</p>'}
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error("Error loading files:", err);
    res.status(500).send("Failed to load APKs: " + err.message);
  }
});

// Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");

    const key = `apks/${Date.now()}-${path.basename(req.file.originalname)}`;
    const params = {
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: "application/vnd.android.package-archive",
    };

    await s3.upload(params).promise();
    res.redirect("/");
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed: " + err.message);
  }
});

// Delete
app.post("/delete", upload.none(), async (req, res) => {
  try {
    console.log("Delete request body:", req.body); // Debug log
    const key = req.body.key;
    if (!key) throw new Error("Invalid file key");
    await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
    res.redirect("/");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Delete failed: " + err.message);
  }
});

// Update
app.post("/update", upload.single("file"), async (req, res) => {
  try {
    const key = req.body.key;
    if (!key) throw new Error("Invalid file key");
    if (!req.file) throw new Error("No file uploaded for update");

    const params = {
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: "application/vnd.android.package-archive",
    };

    await s3.upload(params).promise();
    res.redirect("/");
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Update failed: " + err.message);
  }
});

const PORT = process.env.PORT || 1740;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
