import { encryptData } from './assets/js/crypto-util.js';

const config = {
  projectId: "pembagian-ilmu",
  appId: "1:76877349875:web:b2f53257cc450dfdf70886",
  storageBucket: "pembagian-ilmu.firebasestorage.app",
  apiKey: "AIzaSyDY8VZjslAadLwQZ_6ndt9mzRmXL7W7PxE",
  authDomain: "pembagian-ilmu.firebaseapp.com",
  messagingSenderId: "76877349875",
  measurementId: "G-93L24BGBBK",
  projectNumber: "76877349875",
  version: "2"
};

const password = "senoadi23"; // Using the hint provided earlier

encryptData(JSON.stringify(config), password).then(encrypted => {
  console.log("ENCRYPTED_CONFIG:");
  console.log(encrypted);
});
