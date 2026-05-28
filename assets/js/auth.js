import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export function setupAuth(auth, onUserChanged) {
  onAuthStateChanged(auth, (user) => {
    onUserChanged(user);
  });
}

export async function login(auth, email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw error;
  }
}

export async function logout(auth) {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
}
