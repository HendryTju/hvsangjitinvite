// rsvp.js - Handles writing RSVPs to Firestore or Local Storage Emulation
import { db, isEmulated } from "./firebase-config.js?v=2";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const LOCAL_RSVPS_KEY = "wedding_bingo_emulated_rsvps";

const getLocalRsvps = () => JSON.parse(localStorage.getItem(LOCAL_RSVPS_KEY) || "[]");
const saveLocalRsvps = (rsvps) => localStorage.setItem(LOCAL_RSVPS_KEY, JSON.stringify(rsvps));

/**
 * Submit an RSVP
 */
export async function submitRsvp(data) {
  const rsvpDoc = {
    ...data,
    timestamp: new Date().toISOString(),
    confirmed: false
  };

  if (isEmulated) {
    const rsvps = getLocalRsvps();
    rsvpDoc.id = "emulated_" + Math.random().toString(36).substring(2, 9);
    rsvps.push(rsvpDoc);
    saveLocalRsvps(rsvps);
    console.log("Emulated RSVP saved:", rsvpDoc);
    return rsvpDoc.id;
  } else {
    try {
      const docRef = await addDoc(collection(db, "rsvps"), rsvpDoc);
      return docRef.id;
    } catch (error) {
      console.error("Error adding document: ", error);
      throw error;
    }
  }
}

/**
 * Fetch all RSVPs for admin
 */
export async function getAllRsvps() {
  if (isEmulated) {
    return getLocalRsvps();
  } else {
    try {
      const querySnapshot = await getDocs(collection(db, "rsvps"));
      const rsvps = [];
      querySnapshot.forEach((doc) => {
        rsvps.push({ id: doc.id, ...doc.data() });
      });
      // Sort by newest first
      return rsvps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error("Error fetching RSVPs: ", error);
      throw error;
    }
  }
}

/**
 * Toggle confirm status for admin
 */
export async function toggleRsvpConfirm(id, currentStatus) {
  if (isEmulated) {
    const rsvps = getLocalRsvps();
    const index = rsvps.findIndex(r => r.id === id);
    if (index !== -1) {
      rsvps[index].confirmed = !currentStatus;
      saveLocalRsvps(rsvps);
    }
  } else {
    try {
      const rsvpRef = doc(db, "rsvps", id);
      await updateDoc(rsvpRef, {
        confirmed: !currentStatus
      });
    } catch (error) {
      console.error("Error updating document: ", error);
      throw error;
    }
  }
}

// ==========================================
// SANGJIT RSVPS
// ==========================================
const SANGJIT_LOCAL_KEY = "wedding_bingo_emulated_sangjit_rsvps";
const getSangjitLocalRsvps = () => JSON.parse(localStorage.getItem(SANGJIT_LOCAL_KEY) || "[]");
const saveSangjitLocalRsvps = (rsvps) => localStorage.setItem(SANGJIT_LOCAL_KEY, JSON.stringify(rsvps));

export const HENDRY_DUMMY_RSVPS = [
  { name: "Lim Liong Sen", pax: 2, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "3", isDummy: true },
  { name: "Elwin Lingga", pax: 2, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "3", isDummy: true },
  { name: "Elkania", pax: 2, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "3", isDummy: true },
  { name: "Tjhia Siat Cin", pax: 2, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "3", isDummy: true },
  { name: "Tjandra + Evi", pax: 3, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "3", isDummy: true },
  { name: "Andy + Afung", pax: 3, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "4", isDummy: true },
  { name: "Hendri + Afong", pax: 3, familyGroup: "Keluarga Mama", familyOf: "Hendry", tableNumber: "4", isDummy: true },
  { name: "Tju Djin Tjhong", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "1", isDummy: true },
  { name: "Tju Miauw Tjhong", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "1", isDummy: true },
  { name: "Tju Kong Tjhong (Ahiong)", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "1", isDummy: true },
  { name: "Hengky", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "1", isDummy: true },
  { name: "Lay Ket Bun", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "1", isDummy: true },
  { name: "Michael", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "2", isDummy: true },
  { name: "Ivan Lauwira", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "2", isDummy: true },
  { name: "Tju Se Hien", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "2", isDummy: true },
  { name: "Tju Nyap Liong", pax: 2, familyGroup: "Keluarga Papa", familyOf: "Hendry", tableNumber: "2", isDummy: true }
];

export async function seedSangjitDummyData() {
  const dummyDocs = HENDRY_DUMMY_RSVPS.map((item, index) => ({
    id: "dummy_hendry_" + (index + 1),
    name: item.name,
    pax: item.pax,
    diet: "None",
    familyOf: item.familyOf,
    familyGroup: item.familyGroup,
    tableNumber: item.tableNumber,
    confirmed: true,
    source: "dummy",
    isDummy: true,
    timestamp: new Date().toISOString()
  }));

  if (isEmulated) {
    const existing = getSangjitLocalRsvps().filter(r => !r.isDummy);
    const combined = [...dummyDocs, ...existing];
    saveSangjitLocalRsvps(combined);
    return combined;
  } else {
    try {
      for (const docData of dummyDocs) {
        await addDoc(collection(db, "sangjit_rsvps"), docData);
      }
      return await getAllSangjitRsvps();
    } catch (e) {
      console.warn("Could not write dummy to firestore, fallback to local:", e);
      saveSangjitLocalRsvps(dummyDocs);
      return dummyDocs;
    }
  }
}

export async function submitSangjitRsvp(data) {
  const rsvpDoc = {
    ...data,
    source: "form",
    timestamp: new Date().toISOString(),
    confirmed: false
  };

  if (isEmulated) {
    const rsvps = getSangjitLocalRsvps();
    rsvpDoc.id = "emulated_sangjit_" + Math.random().toString(36).substring(2, 9);
    rsvps.push(rsvpDoc);
    saveSangjitLocalRsvps(rsvps);
    console.log("Emulated Sangjit RSVP saved:", rsvpDoc);
    return rsvpDoc.id;
  } else {
    try {
      const docRef = await addDoc(collection(db, "sangjit_rsvps"), rsvpDoc);
      return docRef.id;
    } catch (error) {
      console.error("Error adding Sangjit document: ", error);
      throw error;
    }
  }
}

export async function getAllSangjitRsvps() {
  if (isEmulated) {
    return getSangjitLocalRsvps();
  } else {
    try {
      const querySnapshot = await getDocs(collection(db, "sangjit_rsvps"));
      const rsvps = [];
      querySnapshot.forEach((doc) => {
        rsvps.push({ id: doc.id, ...doc.data() });
      });
      return rsvps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error("Error fetching Sangjit RSVPs: ", error);
      throw error;
    }
  }
}

export async function toggleSangjitRsvpConfirm(id, currentStatus) {
  if (isEmulated) {
    const rsvps = getSangjitLocalRsvps();
    const index = rsvps.findIndex(r => r.id === id);
    if (index !== -1) {
      rsvps[index].confirmed = !currentStatus;
      saveSangjitLocalRsvps(rsvps);
    }
  } else {
    try {
      const rsvpRef = doc(db, "sangjit_rsvps", id);
      await updateDoc(rsvpRef, {
        confirmed: !currentStatus
      });
    } catch (error) {
      console.error("Error updating Sangjit document: ", error);
      throw error;
    }
  }
}

export async function updateSangjitRsvpAdminFields(id, fields) {
  if (isEmulated) {
    const rsvps = getSangjitLocalRsvps();
    const index = rsvps.findIndex(r => r.id === id);
    if (index !== -1) {
      rsvps[index] = { ...rsvps[index], ...fields };
      saveSangjitLocalRsvps(rsvps);
    }
  } else {
    try {
      const rsvpRef = doc(db, "sangjit_rsvps", id);
      await updateDoc(rsvpRef, fields);
    } catch (error) {
      console.error("Error updating admin fields: ", error);
      throw error;
    }
  }
}

// ==========================================
// ADMIN FUNCTIONS
// ==========================================
export async function updateGuestSide(id, side, collectionType) {
  const collName = collectionType === 'wedding' ? "rsvps" : "sangjit_rsvps";
  
  if (isEmulated) {
    const rsvps = collectionType === 'wedding' ? getLocalRsvps() : getSangjitLocalRsvps();
    const index = rsvps.findIndex(r => r.id === id);
    if (index !== -1) {
      rsvps[index].guestOf = side;
      if (collectionType === 'wedding') saveLocalRsvps(rsvps);
      else saveSangjitLocalRsvps(rsvps);
    }
  } else {
    try {
      const rsvpRef = doc(db, collName, id);
      await updateDoc(rsvpRef, { guestOf: side });
    } catch (error) {
      console.error("Error updating guest side: ", error);
      throw error;
    }
  }
}

export async function adminAddRsvp(data, collectionType) {
  const collName = collectionType === 'wedding' ? "rsvps" : "sangjit_rsvps";
  
  const rsvpDoc = {
    ...data,
    source: "admin",
    timestamp: new Date().toISOString(),
    confirmed: true // Admin additions are auto-confirmed
  };

  if (isEmulated) {
    const rsvps = collectionType === 'wedding' ? getLocalRsvps() : getSangjitLocalRsvps();
    rsvpDoc.id = "emulated_admin_" + Math.random().toString(36).substring(2, 9);
    rsvps.push(rsvpDoc);
    if (collectionType === 'wedding') saveLocalRsvps(rsvps);
    else saveSangjitLocalRsvps(rsvps);
    return rsvpDoc.id;
  } else {
    try {
      const docRef = await addDoc(collection(db, collName), rsvpDoc);
      return docRef.id;
    } catch (error) {
      console.error("Error admin adding document: ", error);
      throw error;
    }
  }
}

export async function adminAddSangjitRsvp(data) {
  const rsvpDoc = {
    ...data,
    source: "admin",
    timestamp: new Date().toISOString(),
    confirmed: true // Auto confirm when admin adds
  };

  if (isEmulated) {
    const rsvps = getSangjitLocalRsvps();
    rsvpDoc.id = "emulated_admin_" + Math.random().toString(36).substring(2, 9);
    rsvps.push(rsvpDoc);
    saveSangjitLocalRsvps(rsvps);
    return rsvpDoc.id;
  } else {
    try {
      const docRef = await addDoc(collection(db, "sangjit_rsvps"), rsvpDoc);
      return docRef.id;
    } catch (error) {
      console.error("Error admin adding Sangjit document: ", error);
      throw error;
    }
  }
}
