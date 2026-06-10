document.addEventListener('DOMContentLoaded', () => {
// --- MARK PRESENT FUNCTIONALITY (attendance.html) ---

const markPresentBtn = document.getElementById('markPresentBtn');

if (markPresentBtn) {
    markPresentBtn.addEventListener('click', () => {
        
        // 1. (Future Logic Placeholder: In a real app, you would send data to the backend here)
        
        // 2. Redirect to the records page after marking attendance
        window.location.href = 'records.html';
    });
}
    // Global variable to hold the camera stream for starting and stopping
    let currentStream = null; 

    // --- 1. LOGIN FUNCTIONALITY (index.html) ---
    // Make the function globally accessible if called via 'onsubmit'
    window.loginUser = function(event) {
        event.preventDefault(); 

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === 'admin' && password === 'password123') {
            window.location.href = 'home.html';
        } else {
            alert('Invalid credentials');
        }
        // The 'return false;' is unnecessary here since preventDefault() is used.
    };


    // --- 2. STUDENT MANAGEMENT FUNCTIONALITY (students.html) ---
    // Connects the button click to the table update logic
    const addButton = document.getElementById('addStudentBtn');
    const inputField = document.getElementById('studentNameInput');
    const tableBody = document.getElementById('studentTableBody');
    const emptyMessage = document.getElementById('emptyMessage');

    if (addButton) {
        // Use an event listener instead of the old 'addStudent' function
        addButton.addEventListener('click', (event) => {
            event.preventDefault(); 

            // Get and clean the student name from the correct ID
            const studentName = inputField.value.trim(); 

            if (studentName) {
                if (emptyMessage) {
                    emptyMessage.style.display = 'none';
                }

                const newRow = document.createElement('tr');
                
                // 🎯 MODIFIED: Include all three columns (Name, Lecs, Status) 🎯
                newRow.innerHTML = `
                    <td>${studentName}</td>
                    <td>0/0</td>
                    <td><span class="status-absent">Not Marked</span></td>
                `;
                
                tableBody.appendChild(newRow);
                inputField.value = ''; 
                
            } else {
                alert('Please enter a student name.');
            }
        });
    }

    // --- 3. CAMERA CONTROL FUNCTIONALITY (attendance.html) ---

    const video = document.getElementById('camera');
    const startBtn = document.getElementById('startCameraBtn');
    const closeBtn = document.getElementById('closeCameraBtn');

    // START CAMERA function (connected via event listener)
    if (startBtn && video) {
        startBtn.addEventListener('click', async () => {
            // Stop any existing stream
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            
            try {
                // Request video stream
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                currentStream = stream; // Save stream globally
                video.style.display = 'block'; 
                
            } catch (err) {
                console.error("Error accessing the camera: ", err);
                alert("Camera not accessible: " + err);
            }
        });
    }

    // CLOSE CAMERA function (New addition to your setup)
    if (closeBtn && video) {
        closeBtn.addEventListener('click', () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => {
                    track.stop();
                });
                currentStream = null;
                video.srcObject = null;
            } else {
                alert("Camera is already closed.");
            }
        });
    }
});