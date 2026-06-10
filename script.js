// Registration
function registerUser(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  let users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[username]) {
    alert('Username already exists!');
    return false;
  }
  users[username] = password;
  localStorage.setItem('users', JSON.stringify(users));
  alert('Registration successful! Please login.');
  window.location.href = 'index.html';
  return false;
}

// Login
function loginUser(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  let users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[username] && users[username] === password) {
    window.location.href = 'home.html';
  } else {
    alert('Invalid credentials');
  }
  return false;
}




// Camera
function startCamera() {
  let video = document.getElementById("camera");
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(function (stream) {
        video.srcObject = stream;
      })
      .catch(function (err) {
        alert("Camera not accessible: " + err);
      });
  }
}

// Student management (for students.html)


function addStudent() {
  const nameInput = document.getElementById("studentNameInput");
  const rollInput = document.getElementById("studentRollInput");
  const name = nameInput.value.trim();
  const rollNo = rollInput.value.trim();
  if (!name || !rollNo) return;

  let students = JSON.parse(localStorage.getItem('students') || '[]');
  students.push({ name, rollNo });
  localStorage.setItem('students', JSON.stringify(students));
  nameInput.value = "";
  rollInput.value = "";
  renderStudentList();
}

function renderStudentList() {
  const container = document.getElementById("studentListContainer");
  if (!container) return;
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  container.innerHTML = students.map((student, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${student.name}</td>
      <td>${student.rollNo}</td>
      <td>
        <button onclick="deleteStudent(${idx})" style="background:#e74c3c;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Delete</button>
      </td>
    </tr>
  `).join('');
}

function deleteStudent(index) {
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  students.splice(index, 1);
  localStorage.setItem('students', JSON.stringify(students));
  renderStudentList();
}

function clearStudentList() {
  localStorage.setItem('students', JSON.stringify([]));
  renderStudentList();
}






// Call renderStudentList on page load if studentListContainer exists
document.addEventListener("DOMContentLoaded", function() {
  if (document.getElementById("studentListContainer")) {
    renderStudentList();
  }
});