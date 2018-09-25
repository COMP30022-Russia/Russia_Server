import * as admin from 'firebase-admin';

const PROJECT_ID = 'rservm';
const CLIENT_EMAIL = 'firebase-adminsdk-0n4r2@rservm.iam.gserviceaccount.com';
const DATABASE_URL = 'https://rservm.firebaseio.com';

// Initalise firebase for production environments
// Adapted from https://stackoverflow.com/questions/39492587
if (process.env.NODE_ENV === 'production') {
    // Initialise app
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: PROJECT_ID,
            clientEmail: CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: DATABASE_URL
    });
}

/**
 * Appends a token to a message.
 * @param {Object} message A token-less payload that is to be sent.
 * @param {token} token The registration token of the receipient.
 * @return {Object} Message with token appended (full message).
 */
export const appendToken = (message: any, token: string) => {
    return { ...message, token };
};

/**
 * Sends a message to the FCM.
 * @param {Object} message The payload to be sent.
 * @return {Promise} Promise object representing the response.
 */
export default async function(message: any) {
    // Send the message and return the response
    return new Promise((resolve, reject) => {
        admin
            .messaging()
            .send(message)
            .then(response => {
                resolve(response);
            })
            .catch(err => {
                reject(err);
            });
    });
}