import bcrypt from 'react-native-bcrypt';

const SALT_ROUNDS = 10;

/**
 * Generates a deterministic salt for bcrypt based on the user's email.
 * Bcrypt salts must be 22 characters long and use a specific alphabet.
 */
const getDeterministicSalt = (email) => {
    // A fixed "skeleton" for the salt to satisfy bcrypt's format requirements
    // The format is $2a$[rounds]$[22 characters]
    const prefix = `$2a$${SALT_ROUNDS}$`;
    
    // We create a predictable string from the email. 
    let emailHash = "";
    const alphabet = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    
    // Simple stable "hash" to get 22 characters from the email
    for (let i = 0; i < 22; i++) {
        let charCode = 0;
        for (let j = 0; j < email.length; j++) {
            charCode = (charCode + email.charCodeAt(j) * (i + j + 1)) % alphabet.length;
        }
        emailHash += alphabet[charCode];
    }
    
    return prefix + emailHash;
};

export const hashPassword = async (password, email = null) => {
    return new Promise((resolve, reject) => {
        // We use setTimeout to allow the UI thread to update (e.g. show loading spinner)
        // because bcrypt.hashSync is CPU intensive and blocks the JS thread.
        setTimeout(() => {
            try {
                const salt = email ? getDeterministicSalt(email.toLowerCase().trim()) : bcrypt.genSaltSync(SALT_ROUNDS);
                const hash = bcrypt.hashSync(password, salt);
                resolve(hash);
            } catch (err) {
                console.error('Password hashing failed:', err);
                reject(err);
            }
        }, 100); // 100ms delay to ensure UI re-render completes
    });
};


export const comparePassword = async (password, hash) => {
    return new Promise((resolve) => {
        try {
            const isMatch = bcrypt.compareSync(password, hash);
            resolve(isMatch);
        } catch (err) {
            console.error('Password comparison failed:', err);
            resolve(false);
        }
    });
};

