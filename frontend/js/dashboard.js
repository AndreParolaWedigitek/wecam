let chart = null;
let detectionsData = [];
let currentDetectionsPage = 1;
const DETECTIONS_PER_PAGE = 20;

let usersData = [];
let currentUsersPage = 1;
const USERS_PER_PAGE = 20;

async function loadStats(){
    const response = await fetch("http://127.0.0.1:8000/stats");
    const data = await response.json();

    let labels = [];
    let values = [];
    let total = 0;

    for(let person in data){
        labels.push(person);
        values.push(data[person]);
        total += data[person];
    }

    document.getElementById("totalDetections").innerText = total;

    if(chart){
        chart.destroy();
    }

    chart = new Chart(document.getElementById("detectionsChart"), {
        type:"bar",
        data:{
            labels:labels,
            datasets:[{
                label:"Deteções",
                data:values,
                backgroundColor: '#1f46ff'
            }]
        },
        options:{
            plugins:{ legend:{ display:false } },
            scales:{ y:{ beginAtZero:true } }
        }
    });
}

async function loadUsers(){
    try{
        const response = await fetch("http://127.0.0.1:8000/users");
        const users = await response.json();
        usersData = users.reverse();
        currentUsersPage = 1;

        const totalUsersEl = document.getElementById("totalUsers");
        if(totalUsersEl) totalUsersEl.innerText = usersData.length;

        renderUsersPage();
    }catch(err){
        console.error('Erro ao carregar utilizadores:', err);
    }
}

function renderUsersPage(){
    const table = document.getElementById("usersTable");
    if(!table) return;

    const totalPages = Math.max(1, Math.ceil(usersData.length / USERS_PER_PAGE));
    if(currentUsersPage > totalPages){
        currentUsersPage = totalPages;
    }

    const startIndex = (currentUsersPage - 1) * USERS_PER_PAGE;
    const pageItems = usersData.slice(startIndex, startIndex + USERS_PER_PAGE);

    table.innerHTML = "";

    pageItems.forEach((u, idx) => {
        const photo = u.photo ? `data:image/jpeg;base64,${u.photo}` : '';
        const imgId = `user-photo-${startIndex + idx}`;
        const imgHtml = photo ? `<img id="${imgId}" src="${photo}" alt="" class="rounded" style="width:64px; height:64px; object-fit:cover;cursor:pointer;" />` : '';

        table.innerHTML += `
            <tr>
                <td>${u.name}</td>
                <td>${imgHtml}</td>
            </tr>
            `;
    });

    pageItems.forEach((u, idx) => {
        if(u.photo){
            const imgId = `user-photo-${startIndex + idx}`;
            const img = document.getElementById(imgId);
            if(img){
                img.onclick = () => openPhotoModal(`data:image/jpeg;base64,${u.photo}`);
            }
        }
    });

    renderUsersPagination(totalPages);
}

function renderUsersPagination(totalPages){
    const container = document.getElementById("usersPageButtons");
    if(!container) return;
    container.innerHTML = "";

    const pagesToShow = [];
    if(totalPages <= 7){
        for(let i = 1; i <= totalPages; i++) pagesToShow.push(i);
    } else {
        pagesToShow.push(1);

        if(currentUsersPage <= 4){
            for(let i = 2; i <= 5; i++) pagesToShow.push(i);
            pagesToShow.push("input");
        } else if(currentUsersPage >= totalPages - 3){
            pagesToShow.push("input");
            for(let i = totalPages - 4; i <= totalPages - 1; i++) pagesToShow.push(i);
        } else {
            pagesToShow.push("input");
            for(let i = currentUsersPage - 1; i <= currentUsersPage + 1; i++) pagesToShow.push(i);
            pagesToShow.push("input");
        }

        pagesToShow.push(totalPages);
    }

    pagesToShow.forEach(page => {
        if(page === "input"){
            const wrapper = document.createElement("div");
            wrapper.className = "page-input";
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "...";
            input.autocomplete = "off";
            input.addEventListener("keydown", event => {
                if(event.key === "Enter"){
                    const value = parseInt(event.target.value, 10);
                    if(!Number.isNaN(value) && value >= 1 && value <= totalPages){
                        currentUsersPage = value;
                        renderUsersPage();
                        event.target.value = "";
                    }
                }
            });
            wrapper.appendChild(input);
            container.appendChild(wrapper);
        } else {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "page-number-btn" + (page === currentUsersPage ? " active" : "");
            button.textContent = page;
            button.onclick = () => {
                currentUsersPage = page;
                renderUsersPage();
            };
            container.appendChild(button);
        }
    });
}

async function registerUser(){
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    const result = document.getElementById('registerResult');

    if(!name){
        if(result) {
            result.innerHTML = `<div class="alert alert-danger">Introduza um nome</div>`;
        } else {
            alert('Introduza um nome');
        }
        return;
    }
    if(!email){
        if(result) {
            result.innerHTML = `<div class="alert alert-danger">Introduza um email</div>`;
        } else {
            alert('Introduza um email');
        }
        return;
    }
    if(!password){
        if(result) {
            result.innerHTML = `<div class="alert alert-danger">Introduza uma password</div>`;
        } else {
            alert('Introduza uma password');
        }
        return;
    }

    try{
        const resp = await fetch(`http://127.0.0.1:8000/capture_user/${encodeURIComponent(name)}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await resp.json();

        const result = document.getElementById('registerResult');
        if(result){
            result.innerHTML = `<div class="alert alert-info">${data.message}</div>`;
        }

        // Clear form fields if successful
        if(data.success){
            if(nameInput) nameInput.value = '';
            if(emailInput) emailInput.value = '';
            if(passwordInput) passwordInput.value = '';
        }

        // reload users to reflect new registration (if successful)
        await loadUsers();
    }catch(e){
        console.error('Erro ao registar utilizador', e);
        const result = document.getElementById('registerResult');
        if(result){
            result.innerHTML = `<div class="alert alert-danger">Erro ao registar utilizador</div>`;
        }
    }
}

function clearRegisterFields(){
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    if(nameInput) nameInput.value = '';
    if(emailInput) emailInput.value = '';
    if(passwordInput) passwordInput.value = '';
}

function cancelRegister(){
    clearRegisterFields();
    const result = document.getElementById('registerResult');
    if(result){
        result.innerHTML = `<div class="alert alert-info">Cancelado!</div>`;
    }
}

// Confirmation modal helper
let __pendingConfirmAction = null;

function showConfirm(message, actionName){
    const modal = document.getElementById('confirmModal');
    if(!modal) return;
    const msgEl = document.getElementById('confirmMessage');
    if(msgEl) msgEl.innerText = message;
    __pendingConfirmAction = actionName;
    modal.style.display = 'flex';
    modal.classList.remove('confirm-open');
    void modal.offsetWidth;
    modal.classList.add('confirm-open');
}

window.addEventListener('load', () => {
    const modal = document.getElementById('confirmModal');
    if(!modal) return;
    const ok = document.getElementById('confirmOkBtn');
    const cancel = document.getElementById('confirmCancelBtn');
    cancel.onclick = () => { modal.style.display = 'none'; __pendingConfirmAction = null; };
    ok.onclick = () => {
        modal.style.display = 'none';
        if(__pendingConfirmAction && typeof window[__pendingConfirmAction] === 'function'){
            try{ window[__pendingConfirmAction](); }catch(e){ console.error(e); }
        }
        __pendingConfirmAction = null;
    };
});

async function loadDetections(){
    const response = await fetch("http://127.0.0.1:8000/detections");
    const data = await response.json();

    detectionsData = data.reverse();
    currentDetectionsPage = 1;
    renderDetectionsPage();
}

function renderDetectionsPage(){
    const table = document.getElementById("detectionsTable");
    const totalPages = Math.max(1, Math.ceil(detectionsData.length / DETECTIONS_PER_PAGE));

    if(currentDetectionsPage > totalPages){
        currentDetectionsPage = totalPages;
    }

    const startIndex = (currentDetectionsPage - 1) * DETECTIONS_PER_PAGE;
    const pageItems = detectionsData.slice(startIndex, startIndex + DETECTIONS_PER_PAGE);

    table.innerHTML = "";

    pageItems.forEach((item, idx) => {
        const date = new Date(item.timestamp);
        const formatted = date.toLocaleString("pt-PT", {
            day:"2-digit",
            month:"2-digit",
            year:"numeric",
            hour:"2-digit",
            minute:"2-digit"
        });

        const photo = item.photo ? `data:image/jpeg;base64,${item.photo}` : '';
        const imgId = `det-photo-${startIndex + idx}`;
        const imgHtml = photo ? `<img id="${imgId}" src="${photo}" alt="" class="rounded" style="width:64px; height:64px; object-fit:cover;cursor:pointer;" />` : '';

        table.innerHTML += `
        <tr>
            <td>${item.person}</td>
            <td>${formatted}</td>
            <td>${imgHtml}</td>
        </tr>
        `;
    });

    // Add click listeners to images after rendering
    pageItems.forEach((item, idx) => {
        if(item.photo){
            const imgId = `det-photo-${startIndex + idx}`;
            const img = document.getElementById(imgId);
            if(img){
                img.onclick = () => openPhotoModal(`data:image/jpeg;base64,${item.photo}`);
            }
        }
    });

    renderDetectionsPagination(totalPages);
}

function renderDetectionsPagination(totalPages){
    const container = document.getElementById("detectionsPageButtons");
    container.innerHTML = "";

    const pagesToShow = [];
    if(totalPages <= 7){
        for(let i = 1; i <= totalPages; i++) pagesToShow.push(i);
    } else {
        pagesToShow.push(1);

        if(currentDetectionsPage <= 4){
            for(let i = 2; i <= 5; i++) pagesToShow.push(i);
            pagesToShow.push("input");
        } else if(currentDetectionsPage >= totalPages - 3){
            pagesToShow.push("input");
            for(let i = totalPages - 4; i <= totalPages - 1; i++) pagesToShow.push(i);
        } else {
            pagesToShow.push("input");
            for(let i = currentDetectionsPage - 1; i <= currentDetectionsPage + 1; i++) pagesToShow.push(i);
            pagesToShow.push("input");
        }

        pagesToShow.push(totalPages);
    }

    pagesToShow.forEach(page => {
        if(page === "input"){
            const wrapper = document.createElement("div");
            wrapper.className = "page-input";
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "...";
            input.autocomplete = "off";
            input.addEventListener("keydown", event => {
                if(event.key === "Enter"){
                    const value = parseInt(event.target.value, 10);
                    if(!Number.isNaN(value) && value >= 1 && value <= totalPages){
                        currentDetectionsPage = value;
                        renderDetectionsPage();
                        event.target.value = "";
                    }
                }
            });
            wrapper.appendChild(input);
            container.appendChild(wrapper);
        } else {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "page-number-btn" + (page === currentDetectionsPage ? " active" : "");
            button.textContent = page;
            button.onclick = () => {
                currentDetectionsPage = page;
                renderDetectionsPage();
            };
            container.appendChild(button);
        }
    });
}

function changeDetectionsPage(delta){
    const totalPages = Math.max(1, Math.ceil(detectionsData.length / DETECTIONS_PER_PAGE));
    currentDetectionsPage = Math.min(Math.max(1, currentDetectionsPage + delta), totalPages);
    renderDetectionsPage();
}

function updateActiveNav(){
    // Use nav order and viewport center to determine active section. Prefer
    // the section whose bounding rect contains the viewport center; otherwise
    // pick the section closest to the center.
    const navLinks = Array.from(document.querySelectorAll('.topbar .nav-link'));
    const sections = navLinks.map(l => {
        const sel = l.getAttribute('href');
        if(!sel || !sel.startsWith('#')) return null;
        return document.querySelector(sel);
    }).filter(Boolean);

    const centerY = window.innerHeight / 2;
    // Choose the section with the largest visible overlap in the viewport.
    let activeSection = null;
    let maxVisible = -1;

    sections.forEach(s => {
        const rect = s.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, 0);
        const visibleBottom = Math.min(rect.bottom, window.innerHeight);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if(visibleHeight > maxVisible){
            maxVisible = visibleHeight;
            activeSection = s;
        }
    });

    const activeId = activeSection ? activeSection.id : null;

    navLinks.forEach(link => {
        const target = link.getAttribute('href');
        if(activeId && target === `#${activeId}`){
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

async function reloadDashboard(){
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'block';
    overlay.classList.add('animate-fade-in-slow');
    
    try {
        await loadStats();
        await loadDetections();
        await loadUsers();
        // ensure nav highlight updates after content changes
        updateActiveNav();
    } finally {
        overlay.classList.remove('animate-fade-in-slow');
        overlay.style.display = 'none';
    }
}

window.addEventListener('scroll', updateActiveNav);
window.addEventListener('load', () => {
    updateActiveNav();
});

window.addEventListener('resize', updateActiveNav);

document.addEventListener('DOMContentLoaded', () => {
    reloadDashboard();
    // Auto-refresh detections every 5 minutes
    setInterval(async () => {
        await loadDetections();
        await loadStats();
        updateActiveNav();
    }, 300000);
});

function openPhotoModal(src){
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('photoModalImg');
  if(!modal || !img) return;
  img.src = src;
  modal.style.display = 'flex';
  modal.classList.add('animate-fade-in');
  // click outside to close
  modal.onclick = (e) => { if(e.target === modal) closePhotoModal(); };
  document.body.style.overflow = 'hidden';
}

function closePhotoModal(){
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('photoModalImg');
  if(!modal || !img) return;
  modal.classList.remove('animate-fade-in');
  modal.style.display = 'none';
  img.src = '';
  modal.onclick = null;
  document.body.style.overflow = '';
}

// close on Escape
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closePhotoModal();
});
