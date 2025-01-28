// import { S3 } from "aws-sdk"
// import fs from "fs";
// import path from "path";

// const s3 = new S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     endpoint: process.env.S3_ENDPOINT
// })
// export const fetchS3Folder = async (key: string, localPath: string): Promise<void> => {
//     try {
//         const params = {
//             Bucket: process.env.S3_BUCKET ?? "",
//             Prefix: key
//         };

//         const response = await s3.listObjectsV2(params).promise();
//         if (response.Contents) {
//             // Use Promise.all to run getObject operations in parallel
//             await Promise.all(response.Contents.map(async (file) => {
//                 const fileKey = file.Key;
//                 if (fileKey) {
//                     const getObjectParams = {
//                         Bucket: process.env.S3_BUCKET ?? "",
//                         Key: fileKey
//                     };

//                     const data = await s3.getObject(getObjectParams).promise();
//                     if (data.Body) {
//                         const fileData = data.Body;
//                         const filePath = `${localPath}/${fileKey.replace(key, "")}`;
                        
//                         await writeFile(filePath, fileData);

//                         console.log(`Downloaded ${fileKey} to ${filePath}`);
//                     }
//                 }
//             }));
//         }
//     } catch (error) {
//         console.error('Error fetching folder:', error);
//     }
// };

// export async function copyS3Folder(sourcePrefix: string, destinationPrefix: string, continuationToken?: string): Promise<void> {
//     try {
//         // List all objects in the source folder
//         const listParams = {
//             Bucket: process.env.S3_BUCKET ?? "",
//             Prefix: sourcePrefix,
//             ContinuationToken: continuationToken
//         };

//         const listedObjects = await s3.listObjectsV2(listParams).promise();

//         if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;
        
//         // Copy each object to the new location
//         await Promise.all(listedObjects.Contents.map(async (object) => {
//             if (!object.Key) return;
//             let destinationKey = object.Key.replace(sourcePrefix, destinationPrefix);
//             let copyParams = {
//                 Bucket: process.env.S3_BUCKET ?? "",
//                 CopySource: `${process.env.S3_BUCKET}/${object.Key}`,
//                 Key: destinationKey
//             };

//             console.log(copyParams);

//             await s3.copyObject(copyParams).promise();
//             console.log(`Copied ${object.Key} to ${destinationKey}`);
//         }));

//         // Check if the list was truncated and continue copying if necessary
//         if (listedObjects.IsTruncated) {
//             listParams.ContinuationToken = listedObjects.NextContinuationToken;
//             await copyS3Folder(sourcePrefix, destinationPrefix, continuationToken);
//         }
//     } catch (error) {
//         console.error('Error copying folder:', error);
//     }
// }

// function writeFile(filePath: string, fileData: Buffer): Promise<void> {
//     return new Promise(async (resolve, reject) => {
//         await createFolder(path.dirname(filePath));

//         fs.writeFile(filePath, fileData, (err) => {
//             if (err) {
//                 reject(err)
//             } else {
//                 resolve()
//             }
//         })
//     });
// }

// function createFolder(dirName: string) {
//     return new Promise<void>((resolve, reject) => {
//         fs.mkdir(dirName, { recursive: true }, (err) => {
//             if (err) {
//                 return reject(err)
//             }
//             resolve()
//         });
//     })
// }

// export const saveToS3 = async (key: string, filePath: string, content: string): Promise<void> => {
//     const params = {
//         Bucket: process.env.S3_BUCKET ?? "",
//         Key: `${key}${filePath}`,
//         Body: content
//     }

//     await s3.putObject(params).promise()
// }

/**
 * This module provides utility functions for interacting with Google Cloud Storage,
 * including downloading, copying, and uploading files.
 */
import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";

// Initialize the Google Cloud Storage client
const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Path to service account key
    projectId: process.env.GCP_PROJECT_ID, // GCP Project ID
});
const bucketName = process.env.GCS_BUCKET ?? "";
const bucket = storage.bucket(bucketName);

/**
 * Fetches all files from a specified GCS folder and saves them to a local directory.
 *
 * @param {string} prefix - The GCS folder path (prefix) to fetch files from.
 * @param {string} localPath - The local directory to save downloaded files.
 * @returns {Promise<void>} Resolves when all files are downloaded.
 */
export const fetchGCSFolder = async (prefix: string, localPath: string): Promise<void> => {
    try {
        const [files] = await bucket.getFiles({ prefix });

        for (const file of files) {
            const relativePath = file.name.replace(prefix, ""); // Remove the prefix from the file path
            
            if (!relativePath || relativePath.endsWith("/")) {
                // Skip directories (GCS often represents folders as objects with "/" suffix)
                console.log(`Skipping directory: ${file.name}`);
                continue;
            }

            const filePath = path.join(localPath, relativePath);

            // Ensure the directory for the file exists
            await createFolder(path.dirname(filePath));

            // Download the file to the local path
            await file.download({ destination: filePath });
            console.log(`Downloaded file: ${file.name} to ${filePath}`);
        }
    } catch (error) {
        console.error("Error fetching GCS folder:", error);
    }
};


/**
 * Copies all files from one GCS folder to another within the same bucket.
 *
 * @param {string} sourcePrefix - The GCS folder path (prefix) to copy files from.
 * @param {string} destinationPrefix - The GCS folder path (prefix) to copy files to.
 * @returns {Promise<void>} Resolves when all files are copied.
 */
export const copyGCSFolder = async (sourcePrefix: string, destinationPrefix: string): Promise<void> => {
    try {
        const [files] = await bucket.getFiles({ prefix: sourcePrefix });

        for (const file of files) {
            const destinationPath = file.name.replace(sourcePrefix, destinationPrefix);
            await file.copy(bucket.file(destinationPath));
            console.log(`Copied ${file.name} to ${destinationPath}`);
        }
    } catch (error) {
        console.error("Error copying GCS folder:", error);
    }
};

/**
 * Writes a file to the local file system, ensuring the folder structure exists.
 *
 * @param {string} filePath - The full path where the file should be saved.
 * @param {Buffer} fileData - The file content to write.
 * @returns {Promise<void>} Resolves when the file is written.
 */
function writeFile(filePath: string, fileData: Buffer): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            await createFolder(path.dirname(filePath));
            fs.writeFile(filePath, fileData, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Creates a folder and its parent directories if they do not exist.
 *
 * @param {string} dirName - The directory path to create.
 * @returns {Promise<void>} Resolves when the folder is created.
 */
function createFolder(dirName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdir(dirName, { recursive: true }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Uploads a file to GCS at the specified key.
 *
 * @param {string} key - The GCS folder path (prefix) for the file.
 * @param {string} filePath - The local file path (used in constructing the GCS key).
 * @param {string} content - The file content to upload.
 * @returns {Promise<void>} Resolves when the file is uploaded.
 */
export const saveToGCS = async (key: string, filePath: string, content: string): Promise<void> => {
    try {
        const file = bucket.file(`${key}${filePath}`);
        await file.save(content);
        console.log(`Uploaded file: ${filePath} to GCS key: ${key}${filePath}`);
    } catch (error) {
        console.error("Error saving to GCS:", error);
    }
};

