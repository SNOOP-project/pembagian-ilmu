import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function listPosts(db) {
  const q = query(collection(db, "posts"), orderBy("updatedAt", "desc"));
  const querySnapshot = await getDocs(q);
  const posts = [];
  querySnapshot.forEach((doc) => {
    posts.push({ id: doc.id, ...doc.data() });
  });
  return posts;
}

export async function loadPost(db, postId) {
  const docRef = doc(db, "posts", postId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function savePost(db, postId, data, userEmail) {
  const docRef = doc(db, "posts", postId);
  await setDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
    lastEditor: userEmail
  }, { merge: true });
}

export async function deletePost(db, postId) {
  await deleteDoc(doc(db, "posts", postId));
}

export async function loadImages(db) {
  const q = query(collection(db, "images"), orderBy("uploadedAt", "desc"));
  const querySnapshot = await getDocs(q);
  const images = [];
  querySnapshot.forEach((doc) => {
    images.push({ id: doc.id, ...doc.data() });
  });
  return images;
}

export async function saveImage(db, imgData) {
  const docRef = doc(collection(db, "images"));
  const entry = {
    ...imgData,
    uploadedAt: new Date().toISOString()
  };
  await setDoc(docRef, entry);
  return { id: docRef.id, ...entry };
}
