// Firebase imports using ES Modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase instances
let app;
let db;
let auth;
let userId = null;
let userEmail = null; // New: To store user's email
let isAuthReady = false;
let isLoadingLLM = false; // New: To control LLM loading spinner
let llmOutputModalMessage = ''; // New: For LLM output modal
let showLlmOutputModalState = false; // Renamed to avoid conflict with function name

// New state for UI dropdowns
let showShareLinkDropdown = false;
let showPendingSubmissionsDropdown = false;

// New state for pending submissions
let pendingSubmissions = [];
let submissionShareLink = ''; // To store the generated shareable link

// New: State variable for view mode
let currentViewMode = 'pc'; // Possible values: 'pc', 'tablet', 'phone'

// Utility function to escape characters that could break HTML or JavaScript contexts
function escapeTemplateLiteral(str) {
    if (typeof str !== 'string') return str;
    // Escape backticks for JS template literals
    // Escape HTML special characters for insertion into HTML content/attributes
    return str.replace(/`/g, '\\`') // Escape backticks for JS template strings
              .replace(/"/g, '&quot;') // Escape double quotes for HTML attributes
              .replace(/'/g, '&#39;'); // Escape single quotes for HTML attributes
}

// IMPORTANT: Replace "AIzaSyATxeJJ7j2HcYm7Ca2ThVtz9HabuQjmHbA" and "1:21096957752:web:0cf6a8d3556b40cb57a3cd"
// with your actual Firebase Web API Key and App ID from your Firebase project settings.
const firebaseConfig = {
    apiKey: "AIzaSyATxeJJ7j2HcYm7Ca2ThVtz9HabuQjmHbA",
    authDomain: "private-lessons-ab22f.firebaseapp.com",
    projectId: "private-lessons-ab22f",
    storageBucket: "private-lessons-ab22f.firebasestorage.app",
    messagingSenderId: "21096957752",
    appId: "1:21096957752:web:0cf6a8d3556b40cb57a3cd",
    measurementId: "G-JMKM2MM8DN"
};

// Ensure __app_id is defined in the Canvas environment.
// For deployed versions, use the appId from firebaseConfig if __app_id is not available.
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.appId;

console.log("Firebase Config being used:", firebaseConfig);

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const predefinedColors = [
    '#EF4444', '#22C55E', '#3B82F6', '#A855F7', '#F97316',
    '#14B8A6', '#6B7280', '#EAB308', '#EC4899', '#84CC16',
    '#06B6D4', '#6D28D9', '#BE123C', '#D97706', '#16A34A',
    '#DC2626', '#FBBF24', '#60A5FA', '#9333EA', '#FB923C',
];

const tumblingSkillsOptions = [
    { level: "Fundamentals", skills: ["Foward roll", "Backroll", "Handstand", "Bridge", "Cartwheel", "Roundoff"] },
    { level: "Level 1", skills: ["Backbend", "Backwalkover", "Front walkover", "Valdez"] },
    { level: "Level 2", skills: ["Standing back handspring", "Front handspring/front bounder", "Standing multiple handspring", "Round off back handspring"] },
    { level: "Level 3", skills: ["Round off back tuck", "Round off back handspring back tuck", "Ariel"] },
    { level: "Level 4", skills: ["Standing back tuck", "Standing back handspring back tuck", "Round off back handspring layout"] },
    { level: "Level 5", skills: ["Round off backhandspring full", "Standing full"] }
];

// Proficiency levels now mapped to a numerical range (0-100) with emojis
const tumblingProficiencyMap = {
    "Don't have the skill yet": { range: [0, 33], display: "Cold 🧊" }, // Changed emoji to 🧊
    "With a little help": { range: [34, 66], display: "Warm ⭐" }, // Changed emoji to ⭐
    "Perfect by themselves": { range: [67, 100], display: "Hot 🔥" }
};

const flyingSkillsOptions = {
    "Lt Leg Skills": ["Lt leg split", "Lt leg heel stretch", "Lt leg liberty", "Lt leg bow and arrow", "Lt leg scorpion", "Lt leg needle", "Lt leg arabesque"],
    "Rt Leg Skills": ["Rt leg split", "Rt leg heel stretch", "Rt leg liberty", "Rt leg bow and arrow", "Rt leg scorpion", "Rt leg needle", "Rt leg arabesque"]
};

// Proficiency levels now mapped to a numerical range (0-100) with emojis
const flyingProficiencyMap = {
    "Stiff as a board": { range: [0, 33], display: "Cold 🧊" }, // Changed emoji to 🧊
    "Needs a little work": { range: [34, 66], display: "Warm ⭐" }, // Changed emoji to ⭐
    "Picture-perfect": { range: [67, 100], display: "Hot 🔥" }
};

const focusCategories = [
    { name: "Flying Only", stars: "⭐" },
    { name: "Tumbling Only", stars: "⭐⭐" },
    { name: "Both (Tumbling & Flying)", stars: "⭐⭐⭐" },
    { name: "Tumbling & Basing", stars: "⭐⭐⭐⭐" }
];

// State variables (simulated with global variables and render function)
let students = [];
let newStudentFirstName = '';
let newStudentLastName = '';
let newParentName = '';
let newStudentPhone = '';
let newParentPhone = '';
// Store proficiency as a number (0-100)
let newTumblingSkillProficiencies = []; // [{ skill: "Handstand", proficiency: 50 }]
let newFlyingSkillProficiencies = []; // [{ skill: "Lt leg heel stretch", proficiency: 75 }]
let newGoals = '';
let newFocusCategory = focusCategories[0].name;
let selectedColor = predefinedColors[0];
let selectedDaysForNewStudent = [];
let showModal = false;
let modalMessage = '';
let editingStudentId = null;
let editingStudentFirstName = '';
let editingStudentLastName = '';
let editingParentName = '';
let editingStudentPhone = '';
let editingParentPhone = '';
// Store proficiency as a number (0-100)
let editingTumblingSkillProficiencies = [];
let editingFlyingSkillProficiencies = [];
let editingGoals = '';
let editingFocusCategory = '';
let editingStudentColor = '';
let editingStudentDays = [];
let expandedStudentId = null;

// State for main collapsible sections
let collapsibleSectionStates = {
    'addStudentFormSection': false, // Start Add Student form collapsed
    'coachAvailabilitySection': false, // Start Availability collapsed
    'currentStudentsSection': true,  // Start Current Students section open
};

let loginEmail = ''; // New: For login/signup
let loginPassword = ''; // New: For login/signup

// --- New: Coach Availability State ---
let coachAvailability = {}; // To be populated from Firestore or defaults

function getDefaultCoachAvailability() {
    const availability = {};
    daysOfWeek.forEach(day => {
        availability[day] = { isBlackedOut: false, unavailableTimes: [] }; // { startMinutes: 0, endMinutes: 0 }
    });
    return availability;
}
function showCustomModal(message) {
    modalMessage = message;
    showModal = true;
    renderApp();
}

function closeCustomModal() {
    showModal = false;
    modalMessage = '';
    renderApp();
}

function displayLlmOutputModal(message) {
    llmOutputModalMessage = message;
    showLlmOutputModalState = true;
    renderApp();
}

function hideLlmOutputModal() {
    showLlmOutputModalState = false;
    llmOutputModalMessage = '';
    renderApp();
}

function generateTimeOptions() {
    const times = [];
    for (let hour = 8; hour <= 21; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const h = hour > 12 ? hour - 12 : hour;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const m = minute === 0 ? '00' : minute;
            const time = `${h}:${m} ${ampm}`;
            times.push(time);
        }
    }
    return times;
}
const timeOptions = generateTimeOptions();

function getStarsForCategory(categoryName) {
    const category = focusCategories.find(cat => cat.name === categoryName);
    return category ? category.stars : '';
}

function formatPhoneNumber(value) {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    let formatted = '';
    if (cleaned.length > 0) { formatted += cleaned.substring(0, 3); }
    if (cleaned.length > 3) { formatted += '-' + cleaned.substring(3, 6); }
    if (cleaned.length > 6) { formatted += '-' + cleaned.substring(6, 10); }
    return formatted;
}

// Helper function to convert numerical proficiency to display string
function getTumblingProficiencyDisplay(value) {
    if (value === null || value === undefined) return "Not rated";
    if (value >= tumblingProficiencyMap["Perfect by themselves"].range[0]) return tumblingProficiencyMap["Perfect by themselves"].display;
    if (value >= tumblingProficiencyMap["With a little help"].range[0]) return tumblingProficiencyMap["With a little help"].display;
    return tumblingProficiencyMap["Don't have the skill yet"].display;
}

function getFlyingProficiencyDisplay(value) {
    if (value === null || value === undefined) return "Not rated";
    if (value >= flyingProficiencyMap["Picture-perfect"].range[0]) return flyingProficiencyMap["Picture-perfect"].display;
    if (value >= flyingProficiencyMap["Needs a little work"].range[0]) return flyingProficiencyMap["Needs a little work"].display;
    return flyingProficiencyMap["Stiff as a board"].display;
}

// Helper function to convert proficiency string to numerical value for slider initialization
function getTumblingProficiencyValue(proficiencyString) {
    if (proficiencyString === "Perfect by themselves") return 80; // Example mid-point for "Hot"
    if (proficiencyString === "With a little help") return 50; // Example mid-point for "Warm"
    if (proficiencyString === "Don't have the skill yet") return 20; // Example mid-point for "Cold"
    return 0; // Default to cold if not set
}

function getFlyingProficiencyValue(proficiencyString) {
    if (proficiencyString === "Picture-perfect") return 80;
    if (proficiencyString === "Needs a little work") return 50;
    if (proficiencyString === "Stiff as a board") return 20;
    return 0;
}

/**
 * Converts a time string (e.g., "9:00 AM", "5:30 PM") to minutes from midnight.
 * @param {string} timeStr - The time string.
 * @returns {number} Total minutes from midnight.
 */
function convertTimeToMinutes(timeStr) {
    const [time, ampm] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (ampm === 'PM' && hours !== 12) {
        hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
        hours = 0; // 12 AM is midnight
    }
    return hours * 60 + minutes;
}

/**
 * Converts total minutes from midnight back to a human-readable time string (e.g., "HH:MM AM/PM").
 * @param {number} totalMinutes - Total minutes from midnight.
 * @returns {string} Formatted time string.
 */
function formatMinutesToTime(totalMinutes) {
    if (totalMinutes < 0 || totalMinutes >= 1440) return 'Invalid Time'; // 24 * 60 = 1440
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;

    return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Parses a time range string (e.g., "9:00 AM - 10:00 AM") into start and end minutes from midnight.
 * @param {string} timeRangeString - The time range string.
 * @returns {{start: number, end: number}} An object with start and end times in minutes.
 */
function parseTimeRange(timeRangeString) {
    if (!timeRangeString || timeRangeString.indexOf(' - ') === -1) {
        return { start: -1, end: -1 }; // Invalid time range
    }
    const [startTimeStr, endTimeStr] = timeRangeString.split(' - ');
    const startMinutes = convertTimeToMinutes(startTimeStr.trim());
    const endMinutes = convertTimeToMinutes(endTimeStr.trim());
    return { start: startMinutes, end: endMinutes };
}

/**
 * Checks if two time ranges overlap.
 * @param {{start: number, end: number}} range1 - The first time range.
 * @param {{start: number, end: number}} range2 - The second time range.
 * @returns {boolean} True if the ranges overlap, false otherwise.
 */
function checkOverlap(range1, range2) {
    // An overlap occurs if the start of one range is before the end of the other,
    // AND the start of the other range is before the end of the first.
    return range1.start < range2.end && range2.start < range1.end;
}

// --- Collapsible Section Helper ---
function toggleCollapsible(headerElement) {
    console.log("toggleCollapsible called for:", headerElement);
    const content = headerElement.nextElementSibling;
    const icon = headerElement.querySelector('.toggle-icon');
    const collapsibleKey = headerElement.dataset.collapsibleKey;

    if (!content || !content.classList.contains('collapsible-content')) {
        console.warn("Collapsible content not found for header:", headerElement);
        return;
    }

    // Determine the new state (should it be open after this click?)
    let shouldBeOpenAfterToggle;
    if (collapsibleKey && collapsibleSectionStates.hasOwnProperty(collapsibleKey)) {
        collapsibleSectionStates[collapsibleKey] = !collapsibleSectionStates[collapsibleKey]; // Toggle state
        shouldBeOpenAfterToggle = collapsibleSectionStates[collapsibleKey];
        console.log(`State for ${collapsibleKey} is now ${shouldBeOpenAfterToggle}`);
    } else {
        // For collapsibles not managed by global state (e.g., nested ones)
        // Base new state on current visual state (is it currently open?)
        const isCurrentlyOpen = headerElement.classList.contains('open');
        shouldBeOpenAfterToggle = !isCurrentlyOpen;
    }

    headerElement.classList.toggle('open', shouldBeOpenAfterToggle);

    if (shouldBeOpenAfterToggle) {
        content.style.maxHeight = content.scrollHeight + "px";
        if (icon) icon.textContent = '−';
    } else {
        content.style.maxHeight = "0px";
        if (icon) icon.textContent = '+'; // Or your preferred icon for closed
    }
}


// --- Firebase Initialization and Authentication ---
async function initializeFirebaseAndAuth() {
    try {
        if (!app) {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
        }

        // Set up the auth state change listener FIRST
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                userEmail = user.email; // Store email if available
                console.log("Auth state changed: User ID set to", userId, "Email:", userEmail);
                setupFirestoreListeners(); // Setup ALL listeners once authenticated user is known
            } else {
                // User is NOT logged in with email/password
                userId = null; // Clear userId if not authenticated by email/password
                userEmail = null;
                console.log("Auth state changed: No email/password user logged in.");
                students = []; // Clear students if not logged in
                pendingSubmissions = []; // Clear pending submissions if not logged in
            }
            isAuthReady = true;
            renderApp(); // Initial render after auth is ready or changed
        });

        // Attempt custom token sign-in if available (Canvas environment)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
                await signInWithCustomToken(auth, __initial_auth_token);
                console.log("Signed in with custom token.");
            } catch (authError) {
                console.warn("Custom token mismatch. The provided custom token is invalid. Please sign in with email/password.");
                showCustomModal(
                    `Authentication failed: The provided custom token is invalid. ` +
                    `Please sign in with your email and password to access your planner data. ` +
                    `(Error: ${escapeTemplateLiteral(authError.message)})`
                );
                // Do NOT fall back to anonymous here, force email/password login for planner owner
            }
        } else {
            // If no custom token and no user currently logged in (e.g., first visit or after sign out)
            if (!auth.currentUser) {
                console.log("No custom token provided and no existing user. Awaiting email/password sign-in.");
                // The onAuthStateChanged listener will handle UI update
            }
        }

    } catch (overallError) {
        console.error("Overall Firebase initialization error:", overallError);
        showCustomModal(`Firebase setup error: ${escapeTemplateLiteral(overallError.message)}`);
        isAuthReady = true;
        renderApp();
    }
}

// --- Email/Password Authentication Functions ---
async function handleSignUp(event) {
    event.preventDefault();
    if (!loginEmail || !loginPassword) {
        showCustomModal("Please enter both email and password for sign up.");
        return;
    }
    try {
        await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        showCustomModal("Account created successfully! You are now signed in.");
        loginEmail = '';
        loginPassword = '';
    } catch (error) {
        console.error("Error signing up:", error);
        showCustomModal(`Sign up failed: ${escapeTemplateLiteral(error.message)}`);
    }
}

async function handleSignIn(event) {
    event.preventDefault();
    if (!loginEmail || !loginPassword) {
        showCustomModal("Please enter both email and password for sign in.");
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        showCustomModal("Signed in successfully!");
        loginEmail = '';
        loginPassword = '';
    } catch (error) {
        console.error("Error signing in:", error);
        showCustomModal(`Sign in failed: ${escapeTemplateLiteral(error.message)}`);
    }
}

async function handleSignOut() {
    try {
        await signOut(auth);
        showCustomModal("Signed out successfully!");
        // onAuthStateChanged will set userId to null, clearing data
    } catch (error) {
        console.error("Error signing out:", error);
        showCustomModal(`Sign out failed: ${escapeTemplateLiteral(error.message)}`);
    }
}

// --- Firestore Data Listeners ---
function setupFirestoreListeners() {
    // Only set up listeners if an email/password user is logged in
    if (!isAuthReady || !db || !userId || !userEmail) {
        console.log("Skipping Firestore listener setup: Not an email/password user or Auth not ready.");
        students = []; // Ensure student list is clear if not logged in
        pendingSubmissions = []; // Ensure pending submissions list is clear if not logged in
        return;
    }
    // Initialize coachAvailability if it's empty (e.g., first load for a user)
    if (Object.keys(coachAvailability).length === 0) {
        coachAvailability = getDefaultCoachAvailability();
        // Optionally, save this default to Firestore immediately if you want it persisted
        // This might be better done after first successful load or on first modification
        // For now, we'll let the listener handle loading/creating it.
    }

    // Listener for Coach Availability
    const availabilityDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'availability');

    console.log("Setting up Firestore listener for userId:", userId);
    const studentsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/students`);

    // Listener for existing students
    onSnapshot(studentsCollectionRef, (snapshot) => {
        students = snapshot.docs.map(doc => {
            const data = doc.data();
            const assignedDays = (data.assignedDays || []).map(item => {
                if (typeof item === 'string') {
                    // Default to a 1-hour slot if only day was saved previously
                    return { day: item, startTime: '9:00 AM', endTime: '10:00 AM' };
                } else if (item.time) {
                    // If old data has 'time' as a single string, parse it
                    const [start, end] = item.time.split(' - ').map(t => t.trim());
                    return { day: item.day, startTime: start, endTime: end };
                }
                return item; // Already in {day, startTime, endTime} format
            });

            // Ensure tumblingSkillProficiencies store numerical values.
            // If old string data exists, convert it to a default numerical value.
            let tumblingSkillProficiencies = [];
            if (Array.isArray(data.tumblingSkillProficiencies)) {
                tumblingSkillProficiencies = data.tumblingSkillProficiencies.map(item => ({
                    skill: item.skill,
                    proficiency: typeof item.proficiency === 'number' ? item.proficiency : getTumblingProficiencyValue(item.proficiency)
                }));
            } else if (typeof data.tumblingSkills === 'string' && data.tumblingSkills.trim() !== '') {
                tumblingSkillProficiencies = [{ skill: data.tumblingSkills.trim(), proficiency: getTumblingProficiencyValue(data.tumblingSkills.trim()) }];
            }

            // Ensure flyingSkillProficiencies store numerical values.
            // If old string data exists, convert it to a default numerical value.
            let flyingSkillProficiencies = [];
            if (Array.isArray(data.flyingSkillProficiencies)) {
                flyingSkillProficiencies = data.flyingSkillProficiencies.map(item => ({
                    skill: item.skill,
                    proficiency: typeof item.proficiency === 'number' ? item.proficiency : getFlyingProficiencyValue(item.proficiency)
                }));
            } else if (typeof data.flyingSkills === 'string' && data.flyingSkills.trim() !== '') {
                flyingSkillProficiencies = [{ skill: data.flyingSkills.trim(), proficiency: getFlyingProficiencyValue(data.flyingSkills.trim()) }];
            }

            return {
                id: doc.id,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                parentName: data.parentName || '',
                studentPhone: data.studentPhone || '',
                parentPhone: data.parentPhone || '',
                tumblingSkillProficiencies: tumblingSkillProficiencies,
                flyingSkillProficiencies: flyingSkillProficiencies,
                goals: data.goals || '',
                focusCategory: data.focusCategory || focusCategories[0].name,
                color: data.color || predefinedColors[0],
                assignedDays: assignedDays
            };
        });
        console.log("Students fetched:", students);
        renderApp();
    }, (error) => {
        console.error("Error fetching students:", error);
        showCustomModal(`Error loading students: ${escapeTemplateLiteral(error.message)}`);
    });

    // Listener for pending submissions
    const pendingSubmissionsCollectionRef = collection(db, `artifacts/${appId}/public_submissions/${userId}/pendingStudents`);
    onSnapshot(pendingSubmissionsCollectionRef, (snapshot) => {
        pendingSubmissions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Pending submissions fetched:", pendingSubmissions);
        renderApp();
    }, (error) => {
        console.error("Error fetching pending submissions:", error);
        showCustomModal(`Error loading pending submissions: ${escapeTemplateLiteral(error.message)}`);
    });

    // Listener for Coach Availability
    onSnapshot(availabilityDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Ensure all days are present, merge with defaults if necessary
            const defaultAvail = getDefaultCoachAvailability();
            coachAvailability = daysOfWeek.reduce((acc, day) => {
                acc[day] = data[day] || defaultAvail[day];
                return acc;
            }, {});
            console.log("Coach availability loaded:", coachAvailability);
        } else {
            console.log("No coach availability document found. Using defaults and creating one.");
            coachAvailability = getDefaultCoachAvailability();
            saveCoachAvailability(); // Save the default to Firestore
        }
        renderApp();
    }, (error) => { console.error("Error fetching coach availability:", error); });
}

// --- LLM Integration Functions ---
async function callGeminiAPI(prompt) {
    isLoadingLLM = true;
    renderApp(); // Show loading spinner

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = ""; // If you want to use models other than gemini-2.0-flash or imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            return text;
        } else {
            console.error("Unexpected LLM response structure:", result);
            throw new Error("Failed to get a valid response from the LLM.");
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        showCustomModal(`Error generating content: ${escapeTemplateLiteral(error.message)}`);
        return null;
    } finally {
        isLoadingLLM = false;
        renderApp(); // Hide loading spinner
    }
}

// --- Event Handlers for Student Data ---
async function handleAddStudent(event) {
    event.preventDefault();
    // Ensure userId is present (meaning an email/password user is logged in)
    if (!newStudentFirstName.trim() || !newStudentLastName.trim() || !userId || !userEmail) {
        showCustomModal("Please enter student's first and last name, and ensure you are logged in with your email/password.");
        return;
    }

    const fullName = `${newStudentFirstName.trim()} ${newStudentLastName.trim()}`;
    const nameExists = students.some(student => `${student.firstName} ${student.lastName}`.toLowerCase() === fullName.toLowerCase());
    if (nameExists) {
        showCustomModal("A student with this full name already exists. Please choose a different name.");
        return;
    }

    const newStudent = {
        firstName: newStudentFirstName.trim(),
        lastName: newStudentLastName.trim(),
        parentName: newParentName.trim(),
        studentPhone: newStudentPhone.trim(),
        parentPhone: newParentPhone.trim(),
        tumblingSkillProficiencies: newTumblingSkillProficiencies, // Now stores numerical values
        flyingSkillProficiencies: newFlyingSkillProficiencies,   // Now stores numerical values
        goals: newGoals.trim(),
        focusCategory: newFocusCategory,
        color: selectedColor,
        assignedDays: selectedDaysForNewStudent,
    };

    try {
        const studentsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/students`);
        await addDoc(studentsCollectionRef, newStudent);
        newStudentFirstName = '';
        newStudentLastName = '';
        newParentName = '';
        newStudentPhone = '';
        newParentPhone = '';
        newTumblingSkillProficiencies = []; // Reset to empty array
        newFlyingSkillProficiencies = [];   // Reset to empty array
        newGoals = '';
        newFocusCategory = focusCategories[0].name;
        selectedColor = predefinedColors[0];
        selectedDaysForNewStudent = [];
        renderApp();
    } catch (error) {
        console.error("Error adding student:", error);
        showCustomModal(`Error adding student: ${escapeTemplateLiteral(error.message)}`);
    }
}

async function handleUpdateStudent(event) {
    event.preventDefault();
    // Ensure userId is present (meaning an email/password user is logged in)
    if (!editingStudentFirstName.trim() || !editingStudentLastName.trim() || !userId || !userEmail || !editingStudentId) {
        showCustomModal("Please enter student's first and last name, and ensure a student is selected for editing, and you are logged in.");
        return;
    }

    const updatedFullName = `${editingStudentFirstName.trim()} ${editingStudentLastName.trim()}`;
    const nameExists = students.some(
        student => student.id !== editingStudentId && `${student.firstName} ${student.lastName}`.toLowerCase() === updatedFullName.toLowerCase()
    );
    if (nameExists) {
        showCustomModal("Another student with this full name already exists. Please choose a different name.");
        return;
    }

    try {
        const studentDocRef = doc(db, `artifacts/${appId}/users/${userId}/students`, editingStudentId);
        await updateDoc(studentDocRef, {
            firstName: editingStudentFirstName.trim(),
            lastName: editingStudentLastName.trim(),
            parentName: editingParentName.trim(),
            studentPhone: editingStudentPhone.trim(),
            parentPhone: editingParentPhone.trim(),
            tumblingSkillProficiencies: editingTumblingSkillProficiencies, // Now stores numerical values
            flyingSkillProficiencies: editingFlyingSkillProficiencies,   // Now stores numerical values
            goals: editingGoals.trim(),
            focusCategory: editingFocusCategory,
            color: editingStudentColor,
            assignedDays: editingStudentDays,
        });
        editingStudentId = null;
        editingStudentFirstName = '';
        editingStudentLastName = '';
        editingParentName = '';
        editingStudentPhone = '';
        editingParentPhone = '';
        editingTumblingSkillProficiencies = [];
        editingFlyingSkillProficiencies = [];
        editingGoals = '';
        editingFocusCategory = '';
        editingStudentColor = '';
        editingStudentDays = [];
        renderApp();
    } catch (error) {
        console.error("Error updating student:", error);
        showCustomModal(`Error updating student: ${escapeTemplateLiteral(error.message)}`);
    }
}

async function handleDeleteStudent(studentIdToDelete) {
    // Ensure userId is present (meaning an email/password user is logged in)
    if (!userId || !userEmail) {
        showCustomModal("Please log in with your email/password to delete students.");
        return;
    }
    try {
        const studentDocRef = doc(db, `artifacts/${appId}/users/${userId}/students`, studentIdToDelete);
        await deleteDoc(studentDocRef);
    } catch (error) {
        console.error("Error deleting student:", error);
        showCustomModal(`Error deleting student: ${escapeTemplateLiteral(error.message)}`);
    }
}

function toggleDayForNewStudent(day) {
    const existingDay = selectedDaysForNewStudent.find(item => item.day === day);
    if (existingDay) {
        selectedDaysForNewStudent = selectedDaysForNewStudent.filter(item => item.day !== day);
    } else {
        selectedDaysForNewStudent = [...selectedDaysForNewStudent, { day: day, startTime: '8:00 AM', endTime: '8:30 AM' }];
    }
    renderApp();
}

function handleTimeChangeForNewStudent(day, type, time) {
    selectedDaysForNewStudent = selectedDaysForNewStudent.map(item => {
        if (item.day === day) {
            return { ...item, [type]: time };
        }
        return item;
    });
    renderApp(); // Add this to re-render the UI after state update
}

function toggleDayForEditingStudent(day) {
    const existingDay = editingStudentDays.find(item => item.day === day);
    if (existingDay) {
        editingStudentDays = editingStudentDays.filter(item => item.day !== day);
    } else {
        editingStudentDays = [...editingStudentDays, { day: day, startTime: '8:00 AM', endTime: '8:30 AM' }];
    }
    renderApp();
}

function handleTimeChangeForEditingStudent(day, type, time) {
    editingStudentDays = editingStudentDays.map(item => {
        if (item.day === day) {
            return { ...item, [type]: time };
        }
        return item;
    });
    renderApp(); // Add this to re-render the UI after state update
}

// Handle proficiency change from slider (now takes numerical value)
function handleTumblingSkillChange(skill, proficiencyValue, isEditing = false, displayElement = null, sliderElement = null) {
    let targetArray = isEditing ? editingTumblingSkillProficiencies : newTumblingSkillProficiencies;
    const existingSkillIndex = targetArray.findIndex(item => item.skill === skill);

    if (existingSkillIndex !== -1) {
        targetArray[existingSkillIndex].proficiency = proficiencyValue;
    } else {
        targetArray.push({ skill: skill, proficiency: proficiencyValue });
    }

    // Update the state variable directly (no need for ...targetArray spread here as it's already a reference)
    if (isEditing) {
        editingTumblingSkillProficiencies = targetArray;
    } else {
        newTumblingSkillProficiencies = targetArray;
    }

    // Directly update the display element without re-rendering the whole app
    if (displayElement) {
        displayElement.textContent = getTumblingProficiencyDisplay(proficiencyValue);
    }

    // Update slider thumb class based on value
    if (sliderElement) {
        sliderElement.classList.remove('slider-cold-value', 'slider-warm-value', 'slider-hot-value'); // Remove all first
        if (proficiencyValue >= tumblingProficiencyMap["Perfect by themselves"].range[0]) {
            sliderElement.classList.add('slider-hot-value');
        } else if (proficiencyValue >= tumblingProficiencyMap["With a little help"].range[0]) {
            sliderElement.classList.add('slider-warm-value');
        } else {
            sliderElement.classList.add('slider-cold-value');
        }
    }
}

function handleFlyingSkillChange(skill, proficiencyValue, isEditing = false, displayElement = null, sliderElement = null) {
    let targetArray = isEditing ? editingFlyingSkillProficiencies : newFlyingSkillProficiencies;
    const existingSkillIndex = targetArray.findIndex(item => item.skill === skill);

    if (existingSkillIndex !== -1) {
        targetArray[existingSkillIndex].proficiency = proficiencyValue;
    } else {
        targetArray.push({ skill: skill, proficiency: proficiencyValue });
    }

    // Update the state variable directly
    if (isEditing) {
        editingFlyingSkillProficiencies = targetArray;
    } else {
        newFlyingSkillProficiencies = targetArray;
    }

    // Directly update the display element without re-rendering the whole app
    if (displayElement) {
        displayElement.textContent = getFlyingProficiencyDisplay(proficiencyValue);
    }

    // Update slider thumb class based on value
    if (sliderElement) {
        sliderElement.classList.remove('slider-cold-value', 'slider-warm-value', 'slider-hot-value'); // Remove all first
        if (proficiencyValue >= flyingProficiencyMap["Picture-perfect"].range[0]) {
            sliderElement.classList.add('slider-hot-value');
        } else if (proficiencyValue >= flyingProficiencyMap["Needs a little work"].range[0]) {
            sliderElement.classList.add('slider-warm-value');
        } else {
            sliderElement.classList.add('slider-cold-value');
        }
    }
}

function startEditing(student) {
    editingStudentId = student.id;
    editingStudentFirstName = student.firstName;
    editingStudentLastName = student.lastName;
    editingParentName = student.parentName;
    editingStudentPhone = student.studentPhone;
    editingParentPhone = student.parentPhone;
    // Ensure proficiencies are numerical values for the sliders
    editingTumblingSkillProficiencies = JSON.parse(JSON.stringify(student.tumblingSkillProficiencies || []));
    editingFlyingSkillProficiencies = JSON.parse(JSON.stringify(student.flyingSkillProficiencies || []));
    editingGoals = student.goals;
    editingFocusCategory = student.focusCategory;
    editingStudentColor = student.color;
    editingStudentDays = (student.assignedDays || []).map(item => {
        // Ensure assignedDays are in {day, startTime, endTime} format for editing
        if (typeof item === 'string') {
            return { day: item, startTime: '8:00 AM', endTime: '8:30 AM' };
        } else if (item.time) {
            const [start, end] = item.time.split(' - ').map(t => t.trim());
            return { day: item.day, startTime: start, endTime: end };
        }
        return item;
    });
    renderApp();
}

function toggleStudentDetails(studentId) {
    console.log("toggleStudentDetails called with studentId:", studentId);
    console.log("Current expandedStudentId (before toggle):", expandedStudentId);
    expandedStudentId = (expandedStudentId === studentId) ? null : studentId;
    console.log("New expandedStudentId (after toggle):", expandedStudentId);

    // If a student's details are being expanded, ensure the "Current Students" section is open.
    if (expandedStudentId !== null) {
        collapsibleSectionStates['currentStudentsSection'] = true;
    }

    renderApp();
}

// --- New: Submission Link and Pending Submissions Logic ---
function generateShareLink() {
    if (!userId || !userEmail) { // Require email/password login to generate shareable link
        showCustomModal("Please sign in with your email/password to generate a shareable link.");
        return;
    }
    // Assumes submission.html is in the same directory as index.html
    // If your GitHub Pages URL is like `https://username.github.io/repo-name/`,
    // then `window.location.origin` will be `https://username.github.io`
    // and `window.location.pathname` might be `/repo-name/` or `/repo-name/index.html`.
    // We need to construct the path to submission.html correctly.
    const currentPath = window.location.href;
    // Remove the current filename (e.g., index.html or a directory if served as root) and query params/hash
    // Ensures the path ends with a slash to correctly append submission.html
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);

    // Construct the full URL to submission.html
    submissionShareLink = `${basePath}submission.html?ownerId=${userId}`;
    renderApp(); // Re-render to display the link

    // Automatically copy to clipboard
    copyShareLinkToClipboard();
}

function copyShareLinkToClipboard() {
    // Target the input field within the dropdown if it exists, otherwise the old one (for graceful transition if needed)
    const linkInput = document.getElementById('submissionShareLinkInputInDropdown') || document.getElementById('submissionShareLinkInput');
    if (linkInput) {
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices

        // Modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(linkInput.value)
                .then(() => showCustomModal("Link copied to clipboard!"))
                .catch(err => {
                    console.error('Failed to copy with navigator.clipboard:', err);
                    // Fallback for environments where navigator.clipboard is not available or fails
                    try {
                        document.execCommand('copy');
                        showCustomModal("Link copied to clipboard! (fallback method)");
                    } catch (execErr) {
                        console.error('Fallback document.execCommand failed:', execErr);
                        showCustomModal("Could not copy link. Please copy manually.");
                    }
                });
        } else {
            // Fallback for older browsers
            try {
                document.execCommand('copy');
                showCustomModal("Link copied to clipboard! (fallback method)");
            } catch (err) {
                console.error('document.execCommand failed:', err);
                showCustomModal("Could not copy link. Please copy manually.");
            }
        }
    } else {
        showCustomModal("Could not find the link to copy.");
    }
}

async function handleApproveSubmission(submission) {
    // Ensure userId is present (meaning an email/password user is logged in)
    if (!userId || !userEmail) {
        showCustomModal("Please log in with your email/password to approve submissions.");
        return;
    }
    try {
        // 1. Add to main students collection - Ensure all new fields are mapped
        const newStudentData = {
            firstName: submission.firstName || '',
            lastName: submission.lastName || '',
            parentName: submission.parentName || '',
            studentPhone: submission.studentPhone || '',
            parentPhone: submission.parentPhone || '',
            goals: submission.goals || '',
            // Correctly map skill proficiencies from submission
            tumblingSkillProficiencies: submission.tumblingSkillProficiencies || [],
            flyingSkillProficiencies: submission.flyingSkillProficiencies || [],
            focusCategory: submission.focusCategory || focusCategories[0].name, // If form sends focus, use it, else default
            color: predefinedColors[Math.floor(Math.random() * predefinedColors.length)], // Assign a random color
            assignedDays: [] // Still no assigned days from submission form, assign manually in planner
        };
        const studentsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/students`);
        await addDoc(studentsCollectionRef, newStudentData);

        // 2. Delete from pending submissions - UPDATED PATH
        const pendingSubmissionDocRef = doc(db, `artifacts/${appId}/public_submissions/${userId}/pendingStudents`, submission.id);
        await deleteDoc(pendingSubmissionDocRef);

        showCustomModal(`${submission.firstName} ${submission.lastName} approved and added to your students!`);
    } catch (error) {
        console.error("Error approving submission:", error);
        showCustomModal(`Error approving submission: ${escapeTemplateLiteral(error.message)}`);
    }
}

async function handleRejectSubmission(submissionId) {
    // Ensure userId is present (meaning an email/password user is logged in)
    if (!userId || !userEmail) {
        showCustomModal("Please log in with your email/password to reject submissions.");
        return;
    }
    try {
        // Delete from pending submissions - UPDATED PATH
        const pendingSubmissionDocRef = doc(db, `artifacts/${appId}/public_submissions/${userId}/pendingStudents`, submissionId);
        await deleteDoc(pendingSubmissionDocRef);
        showCustomModal("Submission rejected and removed.");
    } catch (error) {
        console.error("Error rejecting submission:", error);
        showCustomModal(`Error rejecting submission: ${escapeTemplateLiteral(error.message)}`);
    }
}

// --- New: Coach Availability Handlers ---
async function saveCoachAvailability() {
    if (!userId || !userEmail || !db) {
        console.warn("Cannot save coach availability: User not logged in or DB not initialized.");
        return;
    }
    try {
        const availabilityDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'availability');
        await setDoc(availabilityDocRef, coachAvailability, { merge: true }); // Use merge to be safe
        console.log("Coach availability saved.");
        // No need to show a modal for every save, it should be seamless.
        // renderApp(); // Re-render if immediate UI feedback based on save is needed (usually not)
    } catch (error) {
        console.error("Error saving coach availability:", error);
        showCustomModal(`Error saving availability: ${escapeTemplateLiteral(error.message)}`);
    }
}

function handleToggleDayBlackout(day) {
    if (coachAvailability[day]) {
        coachAvailability[day].isBlackedOut = !coachAvailability[day].isBlackedOut;
        if (coachAvailability[day].isBlackedOut) {
            coachAvailability[day].unavailableTimes = []; // Clear specific times if day is blacked out
        }
        saveCoachAvailability();
        renderApp();
    }
}

function handleAddUnavailableTimeSlot(day) {
    if (coachAvailability[day] && !coachAvailability[day].isBlackedOut) {
        coachAvailability[day].unavailableTimes.push({ startMinutes: convertTimeToMinutes('8:00 AM'), endMinutes: convertTimeToMinutes('9:00 AM') });
        saveCoachAvailability();
        renderApp();
    }
}

function handleRemoveUnavailableTimeSlot(day, index) {
    if (coachAvailability[day] && coachAvailability[day].unavailableTimes[index]) {
        coachAvailability[day].unavailableTimes.splice(index, 1);
        saveCoachAvailability();
        renderApp();
    }
}

function handleUnavailableTimeChange(day, index, type, timeValue) { // timeValue is "HH:MM AM/PM"
    if (coachAvailability[day] && coachAvailability[day].unavailableTimes[index]) {
        coachAvailability[day].unavailableTimes[index][type === 'startTime' ? 'startMinutes' : 'endMinutes'] = convertTimeToMinutes(timeValue);
        saveCoachAvailability();
        renderApp();
    }
}

// New: Function to set the view mode
function setViewMode(mode) {
    currentViewMode = mode;
    renderApp();
}

// --- Helper to close all top dropdowns ---
function closeAllTopDropdowns() {
    let changed = false;
    // Close dropdowns if they are open
    if (showShareLinkDropdown) {
        showShareLinkDropdown = false;
        changed = true;
    }
    if (showPendingSubmissionsDropdown) {
        showPendingSubmissionsDropdown = false;
        changed = true;
    }
    return changed;
}

// --- Main Render Function ---
function renderApp() {
    const appDiv = document.getElementById('app');
    let appInnerContent = ''; // Will hold loading, login, or main app UI

    // Show loading spinner initially or if auth is not ready
    if (!isAuthReady) {
        appInnerContent = `
            <div id="loading-spinner" class="flex flex-col items-center justify-center h-64" role="status" aria-live="polite">
                <div class="loading-spinner"></div>
                <p class="mt-4 text-lg text-gray-700">Loading planner...</p>
                <p class="text-sm text-gray-500 mt-2">Please wait while we connect to your data.</p>
            </div>
        `;
    } else if (!userEmail) { // Prompt for login if not signed in with email/password
         appInnerContent = `
            <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Student Planner</h1>
            <div class="mb-8 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <h2 class="text-2xl font-semibold text-blue-800 mb-4">Welcome! Please Sign In</h2>
                <p class="text-gray-700 mb-4">Sign in with your email and password to manage your student data and accept new submissions.</p>
                <form id="auth-form" class="grid grid-cols-1 gap-4">
                    <div class="form-group">
                        <label for="loginEmail" class="label text-gray-700">Email:</label>
                        <input type="email" id="loginEmail" class="input-field" value="${escapeTemplateLiteral(loginEmail)}" placeholder="your@example.com" required>
                    </div>
                    <div class="form-group">
                        <label for="loginPassword" class="label">Password:</label>
                        <input type="password" id="loginPassword" class="input-field" value="${escapeTemplateLiteral(loginPassword)}" placeholder="********" required>
                    </div>
                    <div class="flex gap-4 mt-2">
                        <button type="submit" id="signInBtn" class="btn btn-blue flex-1">Sign In</button>
                        <button type="submit" id="signUpBtn" class="btn btn-green flex-1">Sign Up (First Time)</button>
                    </div>
                </form>
            </div>
         `;
    }
    else { // Main planner content if logged in with email/password
        appInnerContent = `
            <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Student Planner</h1>

            <!-- Top Bar for Dropdowns -->
            <div class="relative flex justify-between items-start mb-6 z-20">
                <!-- Pending Submissions Dropdown (Top Left) -->
                <div class="relative inline-block text-left">
                    <div>
                        <button type="button" id="togglePendingSubmissionsDropdownBtn" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500">
                            Pending Submissions (${pendingSubmissions.length})
                            <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    ${showPendingSubmissionsDropdown ? `
                        <div class="origin-top-left absolute left-0 mt-2 w-80 sm:w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none max-h-96 overflow-y-auto">
                            <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="pending-submissions-menu">
                                <div class="p-3">
                                    <h3 class="text-lg font-semibold text-yellow-800 mb-3">Pending (${pendingSubmissions.length})</h3>
                                    ${pendingSubmissions.length === 0 ? `
                                        <p class="text-gray-600 text-sm">No pending submissions.</p>
                                    ` : `
                                        <ul class="space-y-3">
                                            ${pendingSubmissions.map(submission => `
                                                <li class="p-3 bg-yellow-50 rounded-lg shadow-sm border border-yellow-200">
                                                    <p class="font-semibold text-gray-800 text-sm">
                                                        ${escapeTemplateLiteral(submission.firstName)} ${escapeTemplateLiteral(submission.lastName)}
                                                        ${submission.studentPhone ? `(${escapeTemplateLiteral(submission.studentPhone)})` : ''}
                                                    </p>
                                                    ${submission.parentName ? `<p class="text-gray-600 text-xs mt-0.5">Parent: ${escapeTemplateLiteral(submission.parentName)} ${submission.parentPhone ? `(${escapeTemplateLiteral(submission.parentPhone)})` : ''}</p>` : ''}
                                                    ${submission.goals ? `<p class="text-gray-600 text-xs mt-0.5">Goals: ${escapeTemplateLiteral(submission.goals)}</p>` : ''}
                                                    ${(submission.tumblingSkillProficiencies || []).length > 0 ?
                                                        `<p class="font-semibold mt-1 text-xs">Tumbling:</p>` +
                                                        (submission.tumblingSkillProficiencies || []).map(ts => `
                                                            <p class="ml-2 text-xs">- ${escapeTemplateLiteral(ts.skill)}: ${escapeTemplateLiteral(getTumblingProficiencyDisplay(ts.proficiency))}</p>
                                                        `).join('')
                                                    : ''}
                                                    ${(submission.flyingSkillProficiencies || []).length > 0 ?
                                                        `<p class="font-semibold mt-1 text-xs">Flying:</p>` +
                                                        (submission.flyingSkillProficiencies || []).map(fs => `
                                                            <p class="ml-2 text-xs">- ${escapeTemplateLiteral(fs.skill)}: ${escapeTemplateLiteral(getFlyingProficiencyDisplay(fs.proficiency))}</p>
                                                        `).join('')
                                                    : ''}
                                                    <p class="text-gray-500 text-xs mt-1">Submitted: ${new Date(submission.submissionDate).toLocaleDateString()}</p>
                                                    <div class="flex gap-2 mt-2">
                                                        <button type="button" class="btn btn-green btn-xs flex-1" data-approve-submission="${escapeTemplateLiteral(submission.id)}">Approve</button>
                                                        <button type="button" class="btn btn-red btn-xs flex-1" data-reject-submission="${escapeTemplateLiteral(submission.id)}">Reject</button>
                                                    </div>
                                                </li>
                                            `).join('')}
                                        </ul>
                                    `}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Share Submission Link Dropdown (Top Right) -->
                <div class="relative inline-block text-right">
                    <div>
                        <button type="button" id="toggleShareLinkDropdownBtn" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500">
                            Share Form
                            <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    ${showShareLinkDropdown ? `
                        <div class="origin-top-right absolute right-0 mt-2 w-80 sm:w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="share-form-menu">
                                <div class="p-3">
                                    <h3 class="text-lg font-semibold text-blue-800 mb-2">Share Student Submission Form</h3>
                                    <p class="text-gray-600 mb-3 text-sm">Generate a link for parents/students to submit their info.</p>
                                    <button type="button" id="generateShareLinkBtnInDropdown" class="btn btn-blue btn-sm mb-3 w-full">Generate Shareable Link</button>
                                    ${submissionShareLink ? `
                                        <div class="form-group flex items-center gap-2">
                                            <input type="text" id="submissionShareLinkInputInDropdown" class="input-field input-sm flex-grow" value="${escapeTemplateLiteral(submissionShareLink)}" readonly>
                                            <button type="button" id="copyShareLinkBtnInDropdown" class="btn btn-green btn-sm px-3 py-1.5">Copy</button>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-1">Share this link with students/parents!</p>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- New: Set Coach Availability Section -->
            <div class="mb-8 p-4 border border-purple-300 rounded-lg bg-purple-50">
                ${ (() => { // IIFE to manage local const for key and isOpen
                    const key = 'coachAvailabilitySection';
                    const isOpen = collapsibleSectionStates[key] === true;
                    return `
                <div class="collapsible-header ${isOpen ? 'open' : ''}" data-collapsible-key="${key}">
                    <h2 class="text-2xl font-semibold text-purple-800 mb-0">Set Your Weekly Availability</h2>
                    <span class="toggle-icon">${isOpen ? '−' : '+'}</span>
                </div>
                <div class="collapsible-content space-y-4" ${isOpen ? '' : 'style="max-height: 0px;"'}>
                    ${daysOfWeek.map(day => `
                        <div class="p-3 border border-purple-200 rounded-md bg-white">
                            <div class="flex items-center justify-between mb-2">
                                <label class="font-medium text-gray-700">${escapeTemplateLiteral(day)}</label>
                                <label class="inline-flex items-center cursor-pointer">
                                    <input type="checkbox" class="form-checkbox h-5 w-5 text-purple-600 rounded" 
                                           data-blackout-day="${escapeTemplateLiteral(day)}" 
                                           ${coachAvailability[day]?.isBlackedOut ? 'checked' : ''}>
                                    <span class="ml-2 text-sm text-gray-600">Blackout entire day</span>
                                </label>
                            </div>
                            ${!coachAvailability[day]?.isBlackedOut ? `
                                <div class="space-y-2">
                                    ${(coachAvailability[day]?.unavailableTimes || []).map((slot, index) => `
                                        <div class="flex items-center gap-2 text-sm">
                                            <span class="text-gray-500">Unavailable:</span>
                                            <select class="input-field py-1 px-2 flex-1" data-unavailable-day="${escapeTemplateLiteral(day)}" data-unavailable-index="${index}" data-time-type="startTime">
                                                ${timeOptions.map(t => `<option value="${escapeTemplateLiteral(t)}" ${formatMinutesToTime(slot.startMinutes) === t ? 'selected' : ''}>${escapeTemplateLiteral(t)}</option>`).join('')}
                                            </select>
                                            <span class="text-gray-500">to</span>
                                            <select class="input-field py-1 px-2 flex-1" data-unavailable-day="${escapeTemplateLiteral(day)}" data-unavailable-index="${index}" data-time-type="endTime">
                                                ${timeOptions.map(t => `<option value="${escapeTemplateLiteral(t)}" ${formatMinutesToTime(slot.endMinutes) === t ? 'selected' : ''}>${escapeTemplateLiteral(t)}</option>`).join('')}
                                            </select>
                                            <button type="button" class="btn btn-red btn-sm px-2 py-1 text-xs" data-remove-unavailable="${escapeTemplateLiteral(day)}" data-slot-index="${index}">X</button>
                                        </div>
                                    `).join('')}
                                    <button type="button" class="btn btn-purple text-sm mt-2" data-add-unavailable="${escapeTemplateLiteral(day)}">Add Unavailable Slot</button>
                                </div>
                            ` : `
                                <p class="text-sm text-gray-500 italic">Entire day is unavailable.</p>
                            `}
                        </div>
                    `).join('')}
                </div>
                    `;
                })() }
            </div>


            <!-- Add New Student Form -->
            <div class="mb-8 p-4 border border-gray-200 rounded-lg"> <!-- Outer container for collapsible -->
                ${ (() => {
                    const key = 'addStudentFormSection';
                    const isOpen = collapsibleSectionStates[key] === true;
                    return `
                <div class="collapsible-header ${isOpen ? 'open' : ''}" data-collapsible-key="${key}">
                    <h2 class="text-2xl font-semibold text-gray-700 mb-0">Add New Student</h2>
                    <span class="toggle-icon">${isOpen ? '−' : '+'}</span>
                </div>
                <form id="add-student-form" class="collapsible-content" ${isOpen ? '' : 'style="max-height: 0px;"'}> <!-- Form becomes the collapsible content -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="form-group lg:col-span-1">
                        <label for="newStudentFirstName" class="label">First Name:</label>
                        <input type="text" id="newStudentFirstName" class="input-field" value="${escapeTemplateLiteral(newStudentFirstName)}" placeholder="e.g., Alice" required>
                    </div>
                    <div class="form-group lg:col-span-1">
                        <label for="newStudentLastName" class="label">Last Name:</label>
                        <input type="text" id="newStudentLastName" class="input-field" value="${escapeTemplateLiteral(newStudentLastName)}" placeholder="e.g., Smith" required>
                    </div>
                    <div class="form-group lg:col-span-2">
                        <label for="newStudentPhone" class="label">Student Phone Number:</label>
                        <input type="tel" id="newStudentPhone" class="input-field" value="${escapeTemplateLiteral(newStudentPhone)}" placeholder="e.g., 555-123-4567" pattern="\\d{3}-\\d{3}-\\d{4}" title="Phone number format: ###-###-####">
                    </div>
                    <div class="form-group lg:col-span-2">
                        <label for="newParentName" class="label">Parent/Guardian Name:</label>
                        <input type="text" id="newParentName" class="input-field" value="${escapeTemplateLiteral(newParentName)}" placeholder="e.g., Jane Doe">
                    </div>
                    <div class="form-group lg:col-span-2">
                        <label for="newParentPhone" class="label">Parent/Guardian Phone Number:</label>
                        <input type="tel" id="newParentPhone" class="input-field" value="${escapeTemplateLiteral(newParentPhone)}" placeholder="e.g., 555-987-6543" pattern="\\d{3}-\\d{3}-\\d{4}" title="Phone number format: ###-###-####">
                    </div>
                </div>
                <div class="form-group">
                    <div class="collapsible-header">
                        <span class="label">Tumbling Skills:</span>
                        <span class="toggle-icon">+</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="explanation-bar"></div>
                        <div class="explanation-text">
                            <span><span class="explanation-emoji">🧊</span>Cold: Don't have</span>
                            <span><span class="explanation-emoji">⭐</span>Warm: You're close</span>
                            <span><span class="explanation-emoji">🔥</span>Hot: Mastered the skill</span>
                        </div>
                        ${tumblingSkillsOptions.map(levelGroup => `
                            <h4 class="font-semibold text-gray-700 mt-4 mb-2">${escapeTemplateLiteral(levelGroup.level)}</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                ${levelGroup.skills.map(skill => {
                                    // Get the current numerical proficiency for this skill, default to 0 if not set
                                    const currentProficiencyValue = newTumblingSkillProficiencies.find(item => item.skill === skill)?.proficiency || 0;
                                    const currentProficiencyDisplay = getTumblingProficiencyDisplay(currentProficiencyValue);
                                    return `
                                        <div class="flex flex-col items-start gap-1 p-2 border border-gray-100 rounded-md bg-white">
                                            <span class="text-gray-700 text-sm font-medium w-full">${escapeTemplateLiteral(skill)}:</span>
                                            <div class="temperature-gauge-container">
                                                <input type="range" min="0" max="100" value="${currentProficiencyValue}" class="temperature-gauge-slider ${currentProficiencyValue >= tumblingProficiencyMap["Perfect by themselves"].range[0] ? 'slider-hot-value' : (currentProficiencyValue >= tumblingProficiencyMap["With a little help"].range[0] ? 'slider-warm-value' : 'slider-cold-value')}" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="new-tumbling">
                                                <div class="temperature-gauge-labels w-full">
                                                    <span>Cold 🧊</span>
                                                    <span class="text-center">Warm ⭐</span>
                                                    <span class="text-right">Hot 🔥</span>
                                                </div>
                                                <span class="current-proficiency-display" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="new-tumbling-display">${escapeTemplateLiteral(currentProficiencyDisplay)}</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <div class="collapsible-header">
                        <span class="label">Flying Skills:</span>
                        <span class="toggle-icon">+</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="explanation-bar"></div>
                        <div class="explanation-text">
                            <span><span class="explanation-emoji">🧊</span>Cold: Don't have</span>
                            <span><span class="explanation-emoji">⭐</span>Warm: You're close</span>
                            <span><span class="explanation-emoji">🔥</span>Hot: Mastered the skill</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 class="font-semibold text-gray-700 mt-4 mb-2">Lt Leg Skills</h4>
                                <div class="grid grid-cols-1 gap-2">
                                    ${flyingSkillsOptions["Lt Leg Skills"].map(skill => {
                                        const currentProficiencyValue = newFlyingSkillProficiencies.find(item => item.skill === skill)?.proficiency || 0;
                                        const currentProficiencyDisplay = getFlyingProficiencyDisplay(currentProficiencyValue);
                                        return `
                                            <div class="flex flex-col items-start gap-1 p-2 border border-gray-100 rounded-md bg-white">
                                                <span class="text-gray-700 text-sm font-medium w-full">${escapeTemplateLiteral(skill)}:</span>
                                                <div class="temperature-gauge-container">
                                                    <input type="range" min="0" max="100" value="${currentProficiencyValue}" class="temperature-gauge-slider ${currentProficiencyValue >= flyingProficiencyMap["Picture-perfect"].range[0] ? 'slider-hot-value' : (currentProficiencyValue >= flyingProficiencyMap["Needs a little work"].range[0] ? 'slider-warm-value' : 'slider-cold-value')}" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="new-flying">
                                                    <div class="temperature-gauge-labels w-full">
                                                        <span>Cold 🧊</span>
                                                        <span class="text-center">Warm ⭐</span>
                                                        <span class="text-right">Hot 🔥</span>
                                                    </div>
                                                    <span class="current-proficiency-display" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="new-flying-display">${escapeTemplateLiteral(currentProficiencyDisplay)}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            <div>
                                <h4 class="font-semibold text-gray-700 mt-4 mb-2">Rt Leg Skills</h4>
                                <div class="grid grid-cols-1 gap-2">
                                    ${flyingSkillsOptions["Rt Leg Skills"].map(skill => {
                                        const currentProficiencyValue = newFlyingSkillProficiencies.find(item => item.skill === skill)?.proficiency || 0;
                                        const currentProficiencyDisplay = getFlyingProficiencyDisplay(currentProficiencyValue);
                                        return `
                                            <div class="flex flex-col items-start gap-1 p-2 border border-gray-100 rounded-md bg-white">
                                                <span class="text-gray-700 text-sm font-medium w-full">${escapeTemplateLiteral(skill)}:</span>
                                                <div class="temperature-gauge-container">
                                                    <input type="range" min="0" max="100" value="${currentProficiencyValue}" class="temperature-gauge-slider ${currentProficiencyValue >= flyingProficiencyMap["Picture-perfect"].range[0] ? 'slider-hot-value' : (currentProficiencyValue >= flyingProficiencyMap["Needs a little work"].range[0] ? 'slider-warm-value' : 'slider-cold-value')}" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="new-flying">
                                                    <div class="temperature-gauge-labels w-full">
                                                        <span>Cold 🧊</span>
                                                        <span class="text-center">Warm ⭐</span>
                                                        <span class="text-right">Hot 🔥</span>
                                                    </div>
                                                    <span class="current-proficiency-display" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="new-flying-display">${escapeTemplateLiteral(currentProficiencyDisplay)}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="newGoals" class="label">Goals / Things to Learn:</label>
                    <textarea id="newGoals" class="input-field h-24" placeholder="e.g., Master full twist, Improve flexibility">${escapeTemplateLiteral(newGoals)}</textarea>
                    <!-- Removed "Suggest Goals" button -->
                </div>
                <div class="form-group">
                    <label class="label">Primary Focus:</label>
                    <select id="newFocusCategory" class="input-field">
                        ${focusCategories.map(category => `
                            <option value="${escapeTemplateLiteral(category.name)}" ${newFocusCategory === category.name ? 'selected' : ''}>${escapeTemplateLiteral(category.name)} ${escapeTemplateLiteral(category.stars)}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="label">Select Color:</label>
                    <div class="flex flex-wrap gap-2">
                        ${predefinedColors.map((color, index) => `
                            <button type="button" class="color-picker-btn ${selectedColor === color ? 'selected' : ''}" style="background-color: ${escapeTemplateLiteral(color)};" data-color="${escapeTemplateLiteral(color)}" title="${escapeTemplateLiteral(color)}"></button>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="label">Assign Days and Times:</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${daysOfWeek.map(day => {
                            const isDaySelected = selectedDaysForNewStudent.some(item => item.day === day);
                            const currentAssignment = selectedDaysForNewStudent.find(item => item.day === day) || { startTime: '8:00 AM', endTime: '8:30 AM' };
                            return `
                                <div class="flex flex-col p-2 border border-gray-200 rounded-lg">
                                    <label class="inline-flex items-center cursor-pointer mb-2">
                                        <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 rounded" ${isDaySelected ? 'checked' : ''} data-day="${escapeTemplateLiteral(day)}">
                                        <span class="ml-2 text-gray-700 font-medium">${escapeTemplateLiteral(day)}</span>
                                    </label>
                                    ${isDaySelected ? `
                                        <div class="flex gap-2">
                                            <select class="input-field text-sm py-1 px-2" data-day-time-type="startTime" data-day="${escapeTemplateLiteral(day)}">
                                                ${timeOptions.map(optionTime => `
                                                    <option value="${escapeTemplateLiteral(optionTime)}" ${currentAssignment.startTime === optionTime ? 'selected' : ''}>${escapeTemplateLiteral(optionTime)}</option>
                                                `).join('')}
                                            </select>
                                            <select class="input-field text-sm py-1 px-2" data-day-time-type="endTime" data-day="${escapeTemplateLiteral(day)}">
                                                ${timeOptions.map(optionTime => `
                                                    <option value="${escapeTemplateLiteral(optionTime)}" ${currentAssignment.endTime === optionTime ? 'selected' : ''}>${escapeTemplateLiteral(optionTime)}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button type="submit" class="btn btn-blue flex-1">Add Student</button>
                    <!-- Removed "Generate New Lesson Plan" button -->
                </div>
                </form> <!-- This was an extra closing form tag, corrected below -->
                    `;
                })() }
            </form>

            <!-- Edit Student Form (Conditional Rendering) -->
            ${editingStudentId ? `
                <form id="edit-student-form-${escapeTemplateLiteral(editingStudentId)}" class="mb-8 p-4 border border-blue-300 rounded-lg bg-blue-50">
                    <h2 class="text-2xl font-semibold text-blue-800 mb-4">Edit Student: ${escapeTemplateLiteral(editingStudentFirstName)} ${escapeTemplateLiteral(editingStudentLastName)}</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="form-group lg:col-span-1">
                            <label for="editStudentFirstName" class="label">First Name:</label>
                            <input type="text" id="editStudentFirstName" class="input-field" value="${escapeTemplateLiteral(editingStudentFirstName)}" data-edit-field="firstName" required>
                        </div>
                        <div class="form-group lg:col-span-1">
                            <label for="editStudentLastName" class="label">Last Name:</label>
                            <input type="text" id="editStudentLastName" class="input-field" value="${escapeTemplateLiteral(editingStudentLastName)}" data-edit-field="lastName" required>
                        </div>
                        <div class="form-group lg:col-span-2">
                            <label for="editStudentPhone" class="label">Student Phone Number:</label>
                            <input type="tel" id="editStudentPhone" class="input-field" value="${escapeTemplateLiteral(editingStudentPhone)}" data-edit-field="studentPhone" pattern="\\d{3}-\\d{3}-\\d{4}" title="Phone number format: ###-###-####">
                        </div>
                        <div class="form-group lg:col-span-2">
                            <label for="editParentName" class="label">Parent/Guardian Name:</label>
                            <input type="text" id="editParentName" class="input-field" value="${escapeTemplateLiteral(editingParentName)}" data-edit-field="parentName">
                        </div>
                        <div class="form-group lg:col-span-2">
                            <label for="editParentPhone" class="label">Parent/Guardian Phone Number:</label>
                            <input type="tel" id="editParentPhone" class="input-field" value="${escapeTemplateLiteral(editingParentPhone)}" data-edit-field="parentPhone" pattern="\\d{3}-\\d{3}-\\d{4}" title="Phone number format: ###-###-####">
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="collapsible-header">
                            <span class="label">Tumbling Skills:</span>
                            <span class="toggle-icon">+</span>
                        </div>
                        <div class="collapsible-content">
                            <div class="explanation-bar"></div>
                            <div class="explanation-text">
                                <span><span class="explanation-emoji">🧊</span>Cold: Don't have</span>
                                <span><span class="explanation-emoji">⭐</span>Warm: You're close</span>
                                <span><span class="explanation-emoji">🔥</span>Hot: Mastered the skill</span>
                            </div>
                            ${tumblingSkillsOptions.map(levelGroup => `
                                <h4 class="font-semibold text-gray-700 mt-4 mb-2">${escapeTemplateLiteral(levelGroup.level)}</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    ${levelGroup.skills.map(skill => {
                                        const currentProficiencyValue = editingTumblingSkillProficiencies.find(item => item.skill === skill)?.proficiency || 0;
                                        const currentProficiencyDisplay = getTumblingProficiencyDisplay(currentProficiencyValue);
                                        return `
                                            <div class="flex flex-col items-start gap-1 p-2 border border-gray-100 rounded-md bg-white">
                                                <span class="text-gray-700 text-sm font-medium w-full">${escapeTemplateLiteral(skill)}:</span>
                                                <div class="temperature-gauge-container">
                                                    <input type="range" min="0" max="100" value="${currentProficiencyValue}" class="temperature-gauge-slider ${currentProficiencyValue >= tumblingProficiencyMap["Perfect by themselves"].range[0] ? 'slider-hot-value' : (currentProficiencyValue >= tumblingProficiencyMap["With a little help"].range[0] ? 'slider-warm-value' : 'slider-cold-value')}" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="edit-tumbling" data-student-id="${escapeTemplateLiteral(editingStudentId)}">
                                                    <div class="temperature-gauge-labels w-full">
                                                        <span>Cold 🧊</span>
                                                        <span class="text-center">Warm ⭐</span>
                                                        <span class="text-right">Hot 🔥</span>
                                                    </div>
                                                    <span class="current-proficiency-display" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="edit-tumbling-display">${escapeTemplateLiteral(currentProficiencyDisplay)}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="collapsible-header">
                            <span class="label">Flying Skills:</span>
                            <span class="toggle-icon">+</span>
                        </div>
                        <div class="collapsible-content">
                            <div class="explanation-bar"></div>
                            <div class="explanation-text">
                                <span><span class="explanation-emoji">🧊</span>Cold: Don't have</span>
                                <span><span class="explanation-emoji">⭐</span>Warm: You're close</span>
                                <span><span class="explanation-emoji">🔥</span>Hot: Mastered the skill</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 class="font-semibold text-gray-700 mt-4 mb-2">Lt Leg Skills</h4>
                                    <div class="grid grid-cols-1 gap-2">
                                        ${flyingSkillsOptions["Lt Leg Skills"].map(skill => {
                                            const currentProficiencyValue = editingFlyingSkillProficiencies.find(item => item.skill === skill)?.proficiency || 0;
                                            const currentProficiencyDisplay = getFlyingProficiencyDisplay(currentProficiencyValue);
                                            return `
                                                <div class="flex flex-col items-start gap-1 p-2 border border-gray-100 rounded-md bg-white">
                                                    <span class="text-gray-700 text-sm font-medium w-full">${escapeTemplateLiteral(skill)}:</span>
                                                    <div class="temperature-gauge-container">
                                                        <input type="range" min="0" max="100" value="${currentProficiencyValue}" class="temperature-gauge-slider ${currentProficiencyValue >= flyingProficiencyMap["Picture-perfect"].range[0] ? 'slider-hot-value' : (currentProficiencyValue >= flyingProficiencyMap["Needs a little work"].range[0] ? 'slider-warm-value' : 'slider-cold-value')}" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="edit-flying" data-student-id="${escapeTemplateLiteral(editingStudentId)}">
                                                        <div class="temperature-gauge-labels w-full">
                                                            <span>Cold 🧊</span>
                                                            <span class="text-center">Warm ⭐</span>
                                                            <span class="text-right">Hot 🔥</span>
                                                        </div>
                                                        <span class="current-proficiency-display" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="edit-flying-display">${escapeTemplateLiteral(currentProficiencyDisplay)}</span>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-700 mt-4 mb-2">Rt Leg Skills</h4>
                                    <div class="grid grid-cols-1 gap-2">
                                        ${flyingSkillsOptions["Rt Leg Skills"].map(skill => {
                                            const currentProficiencyValue = editingFlyingSkillProficiencies.find(item => item.skill === skill)?.proficiency || 0;
                                            const currentProficiencyDisplay = getFlyingProficiencyDisplay(currentProficiencyValue);
                                            return `
                                                <div class="flex flex-col items-start gap-1 p-2 border border-gray-100 rounded-md bg-white">
                                                    <span class="text-gray-700 text-sm font-medium w-full">${escapeTemplateLiteral(skill)}:</span>
                                                    <div class="temperature-gauge-container">
                                                        <input type="range" min="0" max="100" value="${currentProficiencyValue}" class="temperature-gauge-slider ${currentProficiencyValue >= flyingProficiencyMap["Picture-perfect"].range[0] ? 'slider-hot-value' : (currentProficiencyValue >= flyingProficiencyMap["Needs a little work"].range[0] ? 'slider-warm-value' : 'slider-cold-value')}" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="edit-flying" data-student-id="${escapeTemplateLiteral(editingStudentId)}">
                                                        <div class="temperature-gauge-labels w-full">
                                                            <span>Cold 🧊</span>
                                                            <span class="text-center">Warm ⭐</span>
                                                            <span class="text-right">Hot 🔥</span>
                                                        </div>
                                                        <span class="current-proficiency-display" data-skill="${escapeTemplateLiteral(skill)}" data-skill-type="edit-flying-display">${escapeTemplateLiteral(currentProficiencyDisplay)}</span>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="editGoals" class="label">Goals / Things to Learn:</label>
                        <textarea id="editGoals" class="input-field h-24" data-edit-field="goals">${escapeTemplateLiteral(editingGoals)}</textarea>
                        <!-- Removed "Suggest Goals" button -->
                    </div>
                    <div class="form-group">
                        <label class="label">Primary Focus:</label>
                        <select id="editFocusCategory" class="input-field" data-edit-field="focusCategory">
                            ${focusCategories.map(category => `
                                <option value="${escapeTemplateLiteral(category.name)}" ${editingFocusCategory === category.name ? 'selected' : ''}>${escapeTemplateLiteral(category.name)} ${escapeTemplateLiteral(category.stars)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="label">Select Color:</label>
                        <div class="flex flex-wrap gap-2">
                            ${predefinedColors.map((color, index) => `
                                <button type="button" class="color-picker-btn ${editingStudentColor === color ? 'selected' : ''}" style="background-color: ${escapeTemplateLiteral(color)};" data-color="${escapeTemplateLiteral(color)}" data-edit-color="${escapeTemplateLiteral(editingStudentId)}" title="${escapeTemplateLiteral(color)}"></button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="label">Assign Days and Times:</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${daysOfWeek.map(day => {
                                const isDaySelected = editingStudentDays.some(item => item.day === day);
                                const currentAssignment = editingStudentDays.find(item => item.day === day) || { startTime: '8:00 AM', endTime: '8:30 AM' };
                                return `
                                    <div class="flex flex-col p-2 border border-gray-200 rounded-lg">
                                        <label class="inline-flex items-center cursor-pointer mb-2">
                                            <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 rounded" ${isDaySelected ? 'checked' : ''} data-day="${escapeTemplateLiteral(day)}" data-edit-day="${escapeTemplateLiteral(editingStudentId)}">
                                            <span class="ml-2 text-gray-700 font-medium">${escapeTemplateLiteral(day)}</span>
                                        </label>
                                        ${isDaySelected ? `
                                            <div class="flex gap-2">
                                                <select class="input-field text-sm py-1 px-2" data-day-time-type="startTime" data-day="${escapeTemplateLiteral(day)}">
                                                    ${timeOptions.map(optionTime => `
                                                        <option value="${escapeTemplateLiteral(optionTime)}" ${currentAssignment.startTime === optionTime ? 'selected' : ''}>${escapeTemplateLiteral(optionTime)}</option>
                                                    `).join('')}
                                                </select>
                                                <select class="input-field text-sm py-1 px-2" data-day-time-type="endTime" data-day="${escapeTemplateLiteral(day)}">
                                                    ${timeOptions.map(optionTime => `
                                                        <option value="${escapeTemplateLiteral(optionTime)}" ${currentAssignment.endTime === optionTime ? 'selected' : ''}>${escapeTemplateLiteral(optionTime)}</option>
                                                    `).join('')}
                                                </select>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div class="flex gap-2 mt-6">
                        <button type="submit" class="btn btn-green flex-1">Save Changes</button>
                        <button type="button" class="btn btn-gray flex-1" data-cancel-edit="${escapeTemplateLiteral(editingStudentId)}">Cancel</button>
                    </div>
                </form>
            ` : ''}


            <div class="mb-8 p-4 border border-gray-200 rounded-lg">
                ${ (() => {
                    const key = 'currentStudentsSection';
                    const isOpen = collapsibleSectionStates[key] === true;
                    return `
                <div class="collapsible-header ${isOpen ? 'open' : ''}" data-collapsible-key="${key}">
                    <h2 class="text-2xl font-semibold text-gray-700 mb-0">Current Students</h2>
                    <span class="toggle-icon">${isOpen ? '−' : '+'}</span>
                </div>
                <div class="collapsible-content" ${isOpen ? '' : 'style="max-height: 0px;"'}>
                    ${students.length === 0 ? `
                    <p class="text-gray-500">No students added yet. Use the form above to add your first student!</p>
                ` : `
                    <ul class="space-y-3">
                        <li class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm">
                            <div class="flex flex-col items-start mb-2 sm:mb-0 w-full">
                                <div class="font-semibold text-lg text-gray-800 w-full mb-2">Student List</div>
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                                    ${students.map(student => `
                                        <div class="bg-white p-4 rounded-lg shadow-md flex flex-col justify-between" style="border-left: 5px solid ${escapeTemplateLiteral(student.color)};">
                                            <div class="flex-grow">
                                                <span class="font-bold text-lg cursor-pointer hover:underline flex justify-between items-center" style="color: ${escapeTemplateLiteral(student.color)};" data-toggle-details="${escapeTemplateLiteral(student.id)}">
                                                    ${escapeTemplateLiteral(student.firstName)} ${escapeTemplateLiteral(student.lastName)} ${escapeTemplateLiteral(getStarsForCategory(student.focusCategory))}
                                                    <svg class="inline-block w-4 h-4 ml-1 transition-transform transform ${expandedStudentId === student.id ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                </span>
                                                ${expandedStudentId === student.id ? `
                                                    <div class="mt-3 pt-3 border-t border-gray-200 bg-gray-50 p-3 rounded-b-md text-gray-700 text-sm space-y-1">
                                                        <p><strong>Student:</strong> ${escapeTemplateLiteral(student.firstName)} ${escapeTemplateLiteral(student.lastName)} ${student.studentPhone ? `(${escapeTemplateLiteral(student.studentPhone)})` : ''}</p>
                                                        ${student.parentName ? `<p><strong>Parent:</strong> ${escapeTemplateLiteral(student.parentName)} ${student.parentPhone ? `(${escapeTemplateLiteral(student.parentPhone)})` : ''}</p>` : ''}
                                                        ${student.tumblingSkillProficiencies && student.tumblingSkillProficiencies.length > 0 ?
                                                            `<p class="font-semibold mt-2">Tumbling Skills:</p>` +
                                                            student.tumblingSkillProficiencies.map(ts => `
                                                                <p class="ml-4">- ${escapeTemplateLiteral(ts.skill)}: ${escapeTemplateLiteral(getTumblingProficiencyDisplay(ts.proficiency))}</p>
                                                            `).join('')
                                                        : ''}
                                                        ${student.flyingSkillProficiencies && student.flyingSkillProficiencies.length > 0 ?
                                                            `<p class="font-semibold mt-2">Flying Skills:</p>` +
                                                            student.flyingSkillProficiencies.map(fs => `
                                                                <p class="ml-4">- ${escapeTemplateLiteral(fs.skill)}: ${escapeTemplateLiteral(getFlyingProficiencyDisplay(fs.proficiency))}</p>
                                                            `).join('')
                                                        : ''}
                                                        ${student.goals ? `<p><strong>Goals:</strong> ${escapeTemplateLiteral(student.goals)}</p>` : ''}
                                                        ${(student.assignedDays || []).length > 0 ?
                                                            `<p class="font-semibold mt-2">Assigned Days:</p>` +
                                                            student.assignedDays.map(assignment => `
                                                                <p class="ml-2">${escapeTemplateLiteral(assignment.day)}: ${escapeTemplateLiteral(assignment.startTime || 'Not set')} - ${escapeTemplateLiteral(assignment.endTime || 'Not set')}</p>
                                                            `).join('')
                                                        : `<p>No days assigned</p>`}
                                                    </div>
                                                ` : ''}
                                            </div>
                                            <div class="flex gap-2 mt-4">
                                                <button type="button" class="btn btn-yellow text-sm flex-1" data-edit-student="${escapeTemplateLiteral(student.id)}">Edit</button>
                                                <button type="button" class="btn btn-red text-sm flex-1" data-delete-student="${escapeTemplateLiteral(student.id)}">Delete</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </li>
                    </ul>
                `}
                </div>
                    `;
                })() }
            </div>

            <div class="p-4 border border-gray-200 rounded-lg">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 text-center">Weekly Planner</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                    ${daysOfWeek.map(day => {
                        const dayAvailability = coachAvailability[day] || { isBlackedOut: false, unavailableTimes: [] };
                        const studentsOnThisDay = students.filter(s =>
                            (s.assignedDays || []).some(assignment => assignment.day === day)
                        );

                        return `
                            <div class="calendar-day ${dayAvailability.isBlackedOut ? 'day-blacked-out' : ''}">
                                <h3>${escapeTemplateLiteral(day)}</h3>
                                ${dayAvailability.isBlackedOut ? `
                                    <p class="text-sm text-gray-500 italic mt-4">Day Unavailable</p>
                                ` : `
                                    ${(dayAvailability.unavailableTimes || []).length > 0 ? `
                                        <div class="unavailable-slots-indicator text-xs text-red-500 mb-2">
                                            ${dayAvailability.unavailableTimes.map(slot => `
                                                <p>Unavailable: ${escapeTemplateLiteral(formatMinutesToTime(slot.startMinutes))} - ${escapeTemplateLiteral(formatMinutesToTime(slot.endMinutes))}</p>
                                            `).join('')}
                                        </div>` : ''}
                                `}
                                <ul class="list-none p-0 m-0 text-center">
                                    ${studentsOnThisDay.map(student => {
                                        const assignment = student.assignedDays.find(item => item.day === day);
                                        if (!assignment || !assignment.startTime || !assignment.endTime) {
                                            return `<!-- Student ${student.firstName} has incomplete assignment for ${day} -->`;
                                        }

                                        const studentMainRange = parseTimeRange(`${assignment.startTime} - ${assignment.endTime}`);
                                        let timeDisplayHtml = '';

                                        if (studentMainRange.start >= studentMainRange.end) {
                                            timeDisplayHtml = `<span class="text-red-500">Invalid time</span>`;
                                        } else {
                                            let eventPoints = [studentMainRange.start, studentMainRange.end];

                                            // Add Coach Unavailable Event Points (only if day is not blacked out)
                                            if (!dayAvailability.isBlackedOut && dayAvailability.unavailableTimes) {
                                                dayAvailability.unavailableTimes.forEach(slot => {
                                                    eventPoints.push(slot.startMinutes, slot.endMinutes);
                                                });
                                            }

                                            // Add Other Student Event Points
                                            studentsOnThisDay.forEach(otherStudent => {
                                                if (otherStudent.id === student.id) return;
                                                const otherAssignment = otherStudent.assignedDays.find(item => item.day === day);
                                                if (otherAssignment && otherAssignment.startTime && otherAssignment.endTime) {
                                                    const otherRange = parseTimeRange(`${otherAssignment.startTime} - ${otherAssignment.endTime}`);
                                                    if (otherRange.start < otherRange.end) {
                                                        eventPoints.push(otherRange.start, otherRange.end);
                                                    }
                                                }
                                            });

                                            const uniqueSortedEventPoints = [...new Set(eventPoints)].sort((a, b) => a - b);
                                            const timeSegments = [];

                                            for (let i = 0; i < uniqueSortedEventPoints.length - 1; i++) {
                                                const segStart = uniqueSortedEventPoints[i];
                                                const segEnd = uniqueSortedEventPoints[i+1];

                                                if (segStart >= segEnd) continue; // Should not happen with unique sorted points

                                                // Consider only segments *within* the current student's main range
                                                const actualSegStart = Math.max(segStart, studentMainRange.start);
                                                const actualSegEnd = Math.min(segEnd, studentMainRange.end);

                                                if (actualSegStart >= actualSegEnd) continue;

                                                const midPoint = (actualSegStart + actualSegEnd) / 2;
                                                let segmentType = 'normal';

                                                // Check Coach Unavailable (Highest Priority, only if day not blacked out)
                                                if (!dayAvailability.isBlackedOut && dayAvailability.unavailableTimes) {
                                                    for (const unavailableSlot of dayAvailability.unavailableTimes) {
                                                        if (midPoint >= unavailableSlot.startMinutes && midPoint < unavailableSlot.endMinutes) {
                                                            segmentType = 'coach_unavailable';
                                                            break;
                                                        }
                                                    }
                                                }

                                                // Check Student Conflict (Second Priority, if not coach_unavailable and day not blacked out)
                                                if (segmentType === 'normal' && !dayAvailability.isBlackedOut) {
                                                    for (const otherStudent of studentsOnThisDay) {
                                                        if (otherStudent.id === student.id) continue;
                                                        const otherAssignment = otherStudent.assignedDays.find(item => item.day === day);
                                                        if (otherAssignment && otherAssignment.startTime && otherAssignment.endTime) {
                                                            const otherRange = parseTimeRange(`${otherAssignment.startTime} - ${otherAssignment.endTime}`);
                                                            if (otherRange.start < otherRange.end && midPoint >= otherRange.start && midPoint < otherRange.end) {
                                                                segmentType = 'student_conflict';
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                timeSegments.push({ start: actualSegStart, end: actualSegEnd, type: segmentType });
                                            }

                                            if (timeSegments.length > 0) {
                                                timeDisplayHtml = timeSegments.map(seg => {
                                                    const text = `${escapeTemplateLiteral(formatMinutesToTime(seg.start))} - ${escapeTemplateLiteral(formatMinutesToTime(seg.end))}`;
                                                    if (seg.type === 'coach_unavailable') {
                                                        return `<span class="text-black line-through decoration-red-500 decoration-2">${text}</span>`;
                                                    } else if (seg.type === 'student_conflict') {
                                                        return `<span class="text-red-600 font-bold">${text}</span>`;
                                                    }
                                                    return `<span>${text}</span>`; // Normal (will be grey if day is blacked out)
                                                }).join(' ');
                                            } else if (studentMainRange.start < studentMainRange.end) {
                                                // Fallback for a valid slot that didn't generate segments (e.g., isolated, no conflicts)
                                                timeDisplayHtml = `<span>${escapeTemplateLiteral(assignment.startTime)} - ${escapeTemplateLiteral(assignment.endTime)}</span>`;
                                            }
                                        }

                                        const studentLiClasses = `student-item ${dayAvailability.isBlackedOut ? 'text-gray-500' : ''}`;
                                        // Apply student's color only if the day is not blacked out.
                                        const studentLiStyle = dayAvailability.isBlackedOut ? '' : `color: ${escapeTemplateLiteral(student.color)};`;

                                        return `
                                            <li class="${studentLiClasses}" style="${studentLiStyle}">
                                                ${escapeTemplateLiteral(student.firstName)} ${escapeTemplateLiteral(student.lastName)} ${escapeTemplateLiteral(getStarsForCategory(student.focusCategory))}
                                                <span class="student-time">
                                                    ${timeDisplayHtml}
                                                </span>
                                            </li>
                                        `;
                                    }).join('')}
                                </ul>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Auth Section (Moved to Bottom) -->
            <div class="mt-12 mb-6 p-4 border border-gray-300 rounded-lg bg-gray-100 shadow-md">
                <h2 class="text-xl font-semibold text-gray-700 mb-3 text-center">Account Information</h2>
                <div class="flex flex-col sm:flex-row items-center justify-between">
                    <p class="text-gray-600 text-sm mb-2 sm:mb-0">Logged in as: <span class="font-medium text-gray-800">${escapeTemplateLiteral(userEmail)}</span></p>
                    <button type="button" id="signOutBtn" class="btn btn-red btn-sm">Sign Out</button>
                </div>
                <!-- <p class="text-gray-700 text-xs mt-2 text-center">User ID: <span class="font-mono bg-gray-200 px-1 py-0.5 rounded">${escapeTemplateLiteral(userId)}</span></p> -->
            </div>


            <!-- General Modal for messages -->
            ${showModal ? `
                <div class="modal">
                    <div class="modal-content">
                        <h3>${escapeTemplateLiteral(modalMessage.includes('Error') || modalMessage.includes('failed') ? 'Error' : 'Notification')}</h3>
                        <p>${escapeTemplateLiteral(modalMessage)}</p>
                        <button type="button" class="btn btn-blue" id="customModalOkBtn">OK</button>
                    </div>
                </div>
            ` : ''}

            <!-- LLM Output Modal -->
            ${showLlmOutputModalState ? `
                <div class="modal">
                    <div class="modal-content max-w-2xl text-left">
                        ${escapeTemplateLiteral(llmOutputModalMessage)}
                        <button type="button" class="btn btn-blue mt-4" id="llmModalCloseBtn">Close</button>
                    </div>
                </div>
            ` : ''}

            <!-- LLM Loading Spinner Modal -->
            ${isLoadingLLM ? `
                <div class="modal">
                    <div class="modal-content flex flex-col items-center justify-center">
                        <div class="loading-spinner"></div>
                        <p class="mt-4 text-lg text-gray-700">Generating content...</p>
                        <p class="text-sm text-gray-500 mt-2">This may take a moment.</p>
                    </div>
                </div>
            ` : ''}
        `;
    }

    // Determine wrapper style for view mode
    let appContentWrapperStyle = 'margin: 0 auto; transition: max-width 0.3s ease-in-out; padding-top: 5rem; padding-bottom: 2rem;'; // Added padding for sticky bar and bottom content
    if (currentViewMode === 'tablet') {
        appContentWrapperStyle += 'max-width: 768px;'; // Typical tablet width
    } else if (currentViewMode === 'phone') {
        appContentWrapperStyle += 'max-width: 425px;'; // Common phone width
    } else { // PC mode
        appContentWrapperStyle += 'max-width: 100%;'; // Full width or a large container like 'max-width: 1400px;'
    }

    // Construct the final HTML including view mode controls and wrapper
    const finalHtml = `
        <div class="view-mode-controls text-center py-3 px-4 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-b-lg shadow-lg sticky top-0 z-50 border-b border-gray-700">
            <span class="mr-3 font-semibold text-gray-200 text-xs sm:text-sm">VIEW AS:</span>
            <button type="button" class="btn ${currentViewMode === 'phone' ? 'btn-blue' : 'btn-gray'} btn-sm" data-view-mode="phone">Phone</button>
            <button type="button" class="btn ${currentViewMode === 'tablet' ? 'btn-blue' : 'btn-gray'} btn-sm" data-view-mode="tablet">Tablet</button>
            <button type="button" class="btn ${currentViewMode === 'pc' ? 'btn-blue' : 'btn-gray'} btn-sm" data-view-mode="pc">Desktop</button>
        </div>
        <div id="app-content-wrapper" style="${appContentWrapperStyle}">
            ${appInnerContent}
        </div>
    `;

    appDiv.innerHTML = finalHtml;

    // --- Attach Event Listeners (MUST be done after innerHTML update) ---
    if (isAuthReady) {
        // Auth Form
        const loginEmailInput = document.getElementById('loginEmail');
        const loginPasswordInput = document.getElementById('loginPassword');
        const signInBtn = document.getElementById('signInBtn');
        const signUpBtn = document.getElementById('signUpBtn');
        const signOutBtn = document.getElementById('signOutBtn');

        if (loginEmailInput) loginEmailInput.oninput = (e) => { loginEmail = e.target.value; };
        if (loginPasswordInput) loginPasswordInput.oninput = (e) => { loginPassword = e.target.value; };
        if (signInBtn) signInBtn.onclick = handleSignIn;
        if (signUpBtn) signUpBtn.onclick = handleSignUp;
        // signOutBtn is part of appInnerContent when userEmail is true, so it's handled below

        // View Mode Buttons (always available if isAuthReady)
        document.querySelectorAll('.view-mode-controls button[data-view-mode]').forEach(button => {
            button.onclick = (e) => setViewMode(e.target.dataset.viewMode);
        });

        if (signOutBtn) signOutBtn.onclick = handleSignOut;

        // Only attach other listeners if user is signed in with email/password
        if (userEmail) {
            // Dropdown Toggles
            const togglePendingSubmissionsDropdownBtn = document.getElementById('togglePendingSubmissionsDropdownBtn');
            if (togglePendingSubmissionsDropdownBtn) {
                togglePendingSubmissionsDropdownBtn.onclick = () => {
                    showPendingSubmissionsDropdown = !showPendingSubmissionsDropdown;
                    if (showPendingSubmissionsDropdown) showShareLinkDropdown = false; // Close other dropdown
                    renderApp();
                };
            }
            const toggleShareLinkDropdownBtn = document.getElementById('toggleShareLinkDropdownBtn');
            if (toggleShareLinkDropdownBtn) {
                toggleShareLinkDropdownBtn.onclick = () => {
                    showShareLinkDropdown = !showShareLinkDropdown;
                    if (showShareLinkDropdown) showPendingSubmissionsDropdown = false; // Close other dropdown
                    renderApp();
                };
            }
            // Buttons inside the share link dropdown
            const generateShareLinkBtnInDropdown = document.getElementById('generateShareLinkBtnInDropdown');
            if (generateShareLinkBtnInDropdown) {
                generateShareLinkBtnInDropdown.onclick = generateShareLink;
            }
            const copyShareLinkBtnInDropdown = document.getElementById('copyShareLinkBtnInDropdown');
            if (copyShareLinkBtnInDropdown) {
                copyShareLinkBtnInDropdown.onclick = copyShareLinkToClipboard;
            }

            // Pending Submissions (inside dropdown)
            pendingSubmissions.forEach(submission => {
                const approveBtn = appDiv.querySelector(`[data-approve-submission="${submission.id}"]`);
                if (approveBtn) {
                    approveBtn.onclick = () => handleApproveSubmission(submission);
                }
                const rejectBtn = appDiv.querySelector(`[data-reject-submission="${submission.id}"]`);
                if (rejectBtn) {
                    rejectBtn.onclick = () => handleRejectSubmission(submission.id);
                }
            });

            // Coach Availability Section Listeners
            document.querySelectorAll('[data-blackout-day]').forEach(checkbox => {
                checkbox.onchange = (e) => handleToggleDayBlackout(e.target.dataset.blackoutDay);
            });
            document.querySelectorAll('[data-add-unavailable]').forEach(button => {
                button.onclick = (e) => handleAddUnavailableTimeSlot(e.target.dataset.addUnavailable);
            });
            document.querySelectorAll('[data-remove-unavailable]').forEach(button => {
                button.onclick = (e) => handleRemoveUnavailableTimeSlot(e.target.dataset.removeUnavailable, parseInt(e.target.dataset.slotIndex));
            });
            document.querySelectorAll('select[data-unavailable-day]').forEach(select => {
                select.onchange = (e) => {
                    handleUnavailableTimeChange(
                        e.target.dataset.unavailableDay,
                        parseInt(e.target.dataset.unavailableIndex),
                        e.target.dataset.timeType,
                        e.target.value
                    );
                };
            });


            // Add Student Form
            const addForm = document.getElementById('add-student-form');
            if (addForm) {
                addForm.onsubmit = handleAddStudent;

                document.getElementById('newStudentFirstName').oninput = (e) => { newStudentFirstName = e.target.value; };
                document.getElementById('newStudentLastName').oninput = (e) => { newStudentLastName = e.target.value; };
                document.getElementById('newParentName').oninput = (e) => { newParentName = e.target.value; };

                const newStudentPhoneInput = document.getElementById('newStudentPhone');
                newStudentPhoneInput.oninput = (e) => {
                    e.target.value = formatPhoneNumber(e.target.value);
                    newStudentPhone = e.target.value;
                };
                const newParentPhoneInput = document.getElementById('newParentPhone');
                newParentPhoneInput.oninput = (e) => {
                    e.target.value = formatPhoneNumber(e.target.value);
                    newParentPhone = e.target.value;
                };

                document.getElementById('newGoals').oninput = (e) => { newGoals = e.target.value; };
                document.getElementById('newFocusCategory').onchange = (e) => { newFocusCategory = e.target.value; };

                // Attach event listeners for new tumbling skill sliders
                addForm.querySelectorAll('input[type="range"][data-skill-type="new-tumbling"]').forEach(slider => {
                    slider.oninput = (e) => {
                        const displayElement = addForm.querySelector(`span[data-skill="${e.target.dataset.skill}"][data-skill-type="new-tumbling-display"]`);
                        handleTumblingSkillChange(e.target.dataset.skill, parseInt(e.target.value), false, displayElement, e.target);
                    };
                });

                // Attach event listeners for new flying skill sliders
                addForm.querySelectorAll('input[type="range"][data-skill-type="new-flying"]').forEach(slider => {
                    slider.oninput = (e) => {
                        const displayElement = addForm.querySelector(`span[data-skill="${e.target.dataset.skill}"][data-skill-type="new-flying-display"]`);
                        handleFlyingSkillChange(e.target.dataset.skill, parseInt(e.target.value), false, displayElement, e.target);
                    };
                });

                addForm.querySelectorAll('.color-picker-btn').forEach(button => {
                    button.onclick = (e) => { selectedColor = e.target.dataset.color; renderApp(); };
                });

                addForm.querySelectorAll('input[type="checkbox"][data-day]').forEach(checkbox => {
                    checkbox.onchange = (e) => { toggleDayForNewStudent(e.target.dataset.day); };
                });

                // Event listeners for time selects in add form
                addForm.querySelectorAll('select[data-day-time-type]').forEach(select => {
                    select.onchange = (e) => { handleTimeChangeForNewStudent(e.target.dataset.day, e.target.dataset.dayTimeType, e.target.value); };
                });
            }

            // Toggle details for existing students
            appDiv.querySelectorAll('[data-toggle-details]').forEach(element => {
                element.onclick = (e) => { toggleStudentDetails(e.currentTarget.dataset.toggleDetails); }; // Use currentTarget
            });

            // Edit/Delete Buttons for Existing Students
            appDiv.querySelectorAll('[data-edit-student]').forEach(button => {
                button.onclick = () => {
                    const studentId = button.dataset.editStudent;
                    const studentToEdit = students.find(s => s.id === studentId);
                    if (studentToEdit) { startEditing(studentToEdit); }
                };
            });

            appDiv.querySelectorAll('[data-delete-student]').forEach(button => {
                button.onclick = () => {
                    const studentId = button.dataset.deleteStudent;
                    handleDeleteStudent(studentId);
                };
            });

            // Edit Student Forms (dynamically attached)
            if (editingStudentId) {
                const editForm = document.getElementById(`edit-student-form-${editingStudentId}`);
                if (editForm) {
                    editForm.onsubmit = handleUpdateStudent;

                    editForm.querySelector(`[data-edit-field="firstName"]`).oninput = (e) => { editingStudentFirstName = e.target.value; };
                    editForm.querySelector(`[data-edit-field="lastName"]`).oninput = (e) => { editingStudentLastName = e.target.value; };
                    editForm.querySelector(`[data-edit-field="parentName"]`).oninput = (e) => { editingParentName = e.target.value; };

                    const editStudentPhoneInput = editForm.querySelector(`[data-edit-field="studentPhone"]`);
                    editStudentPhoneInput.oninput = (e) => {
                        e.target.value = formatPhoneNumber(e.target.value);
                        editingStudentPhone = e.target.value;
                    };
                    const editParentPhoneInput = editForm.querySelector(`[data-edit-field="parentPhone"]`);
                    editParentPhoneInput.oninput = (e) => {
                        e.target.value = formatPhoneNumber(e.target.value);
                        editingParentPhone = e.target.value;
                    };

                    editForm.querySelector(`[data-edit-field="goals"]`).oninput = (e) => { editingGoals = e.target.value; };
                    editForm.querySelector(`[data-edit-field="focusCategory"]`).onchange = (e) => { editingFocusCategory = e.target.value; };

                    // Attach event listeners for editing tumbling skill sliders
                    editForm.querySelectorAll(`input[type="range"][data-skill-type="edit-tumbling"][data-student-id="${editingStudentId}"]`).forEach(slider => {
                        slider.oninput = (e) => {
                            const displayElement = editForm.querySelector(`span[data-skill="${e.target.dataset.skill}"][data-skill-type="edit-tumbling-display"]`);
                            handleTumblingSkillChange(e.target.dataset.skill, parseInt(e.target.value), true, displayElement, e.target);
                        };
                    });

                    // Attach event listeners for editing flying skill sliders
                    editForm.querySelectorAll(`input[type="range"][data-skill-type="edit-flying"][data-student-id="${editingStudentId}"]`).forEach(slider => {
                        slider.oninput = (e) => {
                            const displayElement = editForm.querySelector(`span[data-skill="${e.target.dataset.skill}"][data-skill-type="edit-flying-display"]`);
                            handleFlyingSkillChange(e.target.dataset.skill, parseInt(e.target.value), true, displayElement, e.target);
                        };
                    });

                    editForm.querySelectorAll(`[data-edit-color="${editingStudentId}"]`).forEach(button => {
                        button.onclick = (e) => { editingStudentColor = e.target.dataset.color; renderApp(); };
                    });

                    editForm.querySelectorAll(`input[type="checkbox"][data-edit-day="${editingStudentId}"]`).forEach(checkbox => {
                        checkbox.onchange = (e) => { toggleDayForEditingStudent(e.target.dataset.day); };
                    });

                    // Event listeners for time selects in edit form
                    editForm.querySelectorAll(`select[data-day-time-type][data-day]`).forEach(select => {
                        select.onchange = (e) => { handleTimeChangeForEditingStudent(e.target.dataset.day, e.target.dataset.dayTimeType, e.target.value); };
                    });

                    const cancelEditButton = editForm.querySelector(`[data-cancel-edit="${editingStudentId}"]`);
                    if (cancelEditButton) {
                        cancelEditButton.onclick = () => {
                            editingStudentId = null;
                            editingStudentFirstName = '';
                            editingStudentLastName = '';
                            editingParentName = '';
                            editingStudentPhone = '';
                            editingParentPhone = '';
                            editingTumblingSkillProficiencies = [];
                            editingFlyingSkillProficiencies = [];
                            editingGoals = '';
                            editingFocusCategory = '';
                            editingStudentColor = '';
                            editingStudentDays = [];
                            renderApp();
                        };
                    }
                }
            }
        }
    }

    if (showModal) {
        const modalButton = document.getElementById('customModalOkBtn');
        if (modalButton) { modalButton.onclick = closeCustomModal; }
    }

    if (showLlmOutputModalState) {
        const llmModalButton = document.getElementById('llmModalCloseBtn');
        if (llmModalButton) { llmModalButton.onclick = hideLlmOutputModal; }
    }

    // Post-render setup for collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.toggle-icon');
        const collapsibleKey = header.dataset.collapsibleKey;

        if (content && content.classList.contains('collapsible-content')) {
            let isEffectivelyOpen;

            if (collapsibleKey && collapsibleSectionStates.hasOwnProperty(collapsibleKey)) {
                isEffectivelyOpen = collapsibleSectionStates[collapsibleKey];
                // Sync class and icon with the state
                header.classList.toggle('open', isEffectivelyOpen);
                if (icon) icon.textContent = isEffectivelyOpen ? '−' : '+';
            } else {
                // For collapsibles not managed by global state (e.g., skills sections within forms)
                // their state is determined by the 'open' class in the HTML template,
                // or they default to closed if no 'open' class.
                isEffectivelyOpen = header.classList.contains('open');
                if (icon) icon.textContent = isEffectivelyOpen ? '−' : '+'; // Sync icon
            }

            // Set maxHeight based on the determined open state
            if (isEffectivelyOpen) {
                // If it should be open, ensure maxHeight allows content visibility.
                // scrollHeight gives the actual height of the content.
                content.style.maxHeight = content.scrollHeight + "px";
            } else {
                content.style.maxHeight = "0px";
            }

            // Add event listener (old ones are removed by innerHTML replacement)
            header.addEventListener('click', function() { toggleCollapsible(this); });
        }
    });
}

let isDocumentClickListenerAdded = false; // Flag to ensure it's added only once

// --- Initial Load ---
window.onload = () => {
    // Apply background gradient
    document.body.style.backgroundImage = 'linear-gradient(to bottom, #87CEEB, #9370DB)'; // Sky Blue to Medium Purple
    // A slightly more subtle and modern gradient:
    // document.body.style.backgroundImage = 'linear-gradient(to bottom right, #a0c4ff, #c77dff)'; // Light Blue to Light Purple
    // document.body.style.backgroundImage = 'linear-gradient(135deg, #6DD5FA 0%, #FF758C 100%)'; // Example: Blue to Pinkish
    // document.body.style.backgroundImage = 'linear-gradient(to right, #74ebd5, #ACB6E5)'; // Teal to Light Purple/Blue
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.minHeight = '100vh';

    initializeFirebaseAndAuth();
    // renderApp() is called by onAuthStateChanged or initializeFirebaseAndAuth error handling

    // Add document click listener for closing dropdowns (only once)
    if (!isDocumentClickListenerAdded) {
        document.addEventListener('click', function(event) {
            const appDiv = document.getElementById('app');
            if (!appDiv || !appDiv.contains(event.target)) return; // Only act on clicks within the app

            const isDropdownButton = event.target.closest('#togglePendingSubmissionsDropdownBtn, #toggleShareLinkDropdownBtn');
            // Check against the actual dropdown panel elements if they exist
            const pendingDropdownPanel = document.querySelector('.origin-top-left.absolute'); // More specific selector if needed
            const shareDropdownPanel = document.querySelector('.origin-top-right.absolute'); // More specific selector if needed

            let clickedInsideADropdownContent = (pendingDropdownPanel && pendingDropdownPanel.contains(event.target)) ||
                                              (shareDropdownPanel && shareDropdownPanel.contains(event.target));

            if (!isDropdownButton && !clickedInsideADropdownContent) {
                if (closeAllTopDropdowns()) renderApp();
            }
        });
        isDocumentClickListenerAdded = true;
    }
};
