// DOM Elements
const csvInput = document.getElementById('csv-upload');
const xlsxInput = document.getElementById('xlsx-upload');
const csvStatus = document.getElementById('csv-status');
const xlsxStatus = document.getElementById('xlsx-status');
const processBtn = document.getElementById('process-files-btn');
const topNav = document.getElementById('top-nav');
const dashboardContent = document.getElementById('original-dashboard');
const filtersContainer = document.getElementById('filters-container');
const uploadSection = document.getElementById('upload-section');
const cumulativeExportContainer = document.getElementById('cumulative-export-container');

// Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

// Global State
let globalData = []; // CSV Candidates
let globalPositions = []; // Excel Positions
let filteredPositions = []; // Filtered Excel Positions for RAOG
let currentHireableRows = []; // Filtered rows for the table
let currentFilteredData = []; // Store current filtered data for global export usage
const CURRENT_DATE = new Date();
CURRENT_DATE.setHours(0,0,0,0);

// File Selection Listeners
csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        csvStatus.innerText = "Processing CSV...";
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                globalData = results.data;
                currentFilteredData = globalData;
                csvStatus.innerHTML = `Loaded ${globalData.length} records <i class="ri-checkbox-circle-line"></i>`;
                csvStatus.style.color = "#10b981";
                checkReady();
            }
        });
    }
});

xlsxInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        xlsxStatus.innerText = "Processing Excel...";
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            globalPositions = XLSX.utils.sheet_to_json(sheet);
            xlsxStatus.innerHTML = `Loaded ${globalPositions.length} positions <i class="ri-checkbox-circle-line"></i>`;
            xlsxStatus.style.color = "#10b981";
            checkReady();
        };
        reader.readAsArrayBuffer(file);
    }
});

function checkReady() {
    if (globalData.length > 0 || globalPositions.length > 0) {
        processBtn.disabled = false;
    }
}

processBtn.addEventListener('click', () => {
    initializeDashboard();
    uploadSection.style.display = 'none';
    topNav.style.display = 'flex';
    
    // Logic for partial uploads
    const opBtn = document.querySelector('[data-view="original-dashboard"]');
    const posBtn = document.querySelector('[data-view="position-dashboard"]');
    
    if (globalData.length === 0) {
        opBtn.style.display = 'none';
        posBtn.click(); // Switch to position dashboard if only excel uploaded
    } else if (globalPositions.length === 0) {
        posBtn.style.display = 'none';
        opBtn.click(); // Switch to original dashboard if only csv uploaded
    } else {
        opBtn.click(); // Default to original if both present
    }
    
    if(cumulativeExportContainer) {
        cumulativeExportContainer.style.display = globalData.length > 0 ? 'block' : 'none';
    }
});

// View Switching
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetView = btn.getAttribute('data-view');
        
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        views.forEach(v => v.style.display = 'none');
        document.getElementById(targetView).style.display = 'block';
        
        // Toggle shared filter container visibility
        if (targetView === 'original-dashboard') {
            filtersContainer.style.display = 'flex';
        } else {
            filtersContainer.style.display = 'none';
        }
    });
});

function initializeDashboard() {
    // 1. Setup Original Dashboard if CSV present
    if (globalData.length > 0) {
        initializeFilters();
        renderOriginalDashboard(globalData);
    }

    // 2. Setup Position Dashboard if Excel present
    if (globalPositions.length > 0) {
        populatePositionFilters();
        updatePositionMetrics();
    }
}

// --- ORIGINAL DASHBOARD LOGIC ---

const agencyFilter = document.getElementById('agency-filter');
const stateFilter = document.getElementById('state-filter');

function initializeFilters() {
    const agencies = ['All', ...new Set(globalData.map(d => d['agency']).filter(Boolean))];
    const states = ['All', ...new Set(globalData.map(d => d['requisition State']).filter(Boolean))];

    agencyFilter.innerHTML = agencies.map(a => `<option value="${a}">${a.length > 30 ? a.substring(0,30)+'...' : a}</option>`).join('');
    stateFilter.innerHTML = states.map(s => `<option value="${s}">${s}</option>`).join('');

    agencyFilter.onchange = updateOriginalFilters;
    stateFilter.onchange = updateOriginalFilters;
}

function updateOriginalFilters() {
    let filtered = globalData;
    if (agencyFilter.value !== 'All') filtered = filtered.filter(row => row['agency'] === agencyFilter.value);
    if (stateFilter.value !== 'All') filtered = filtered.filter(row => row['requisition State'] === stateFilter.value);
    currentFilteredData = filtered;
    renderOriginalDashboard(filtered);
}

const parseDate = (dateString, isMMDDYYYY) => {
    if (!dateString) return null;
    const parts = dateString.split(' ');
    if (parts.length === 0) return null;
    const dateParts = parts[0].split('/');
    if (dateParts.length !== 3) return null;
    
    let month, day, year;
    if (isMMDDYYYY) {
        month = parseInt(dateParts[0]) - 1;
        day = parseInt(dateParts[1]);
        year = parseInt(dateParts[2]);
    } else {
        day = parseInt(dateParts[0]);
        month = parseInt(dateParts[1]) - 1;
        year = parseInt(dateParts[2]);
    }
    if (year < 100) year += 2000;
    return new Date(year, month, day);
};

const getDaysDifference = (targetDate) => {
    if (!targetDate) return -1;
    const diffTime = Math.abs(CURRENT_DATE.getTime() - targetDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

function renderOriginalDashboard(data) {
    let metrics = {
        haGenerated: { '< 3 Days': 0, '3 - 7 Days': 0, '> 7 Days': 0, total: 0 },
        readyToOffer: { '< 3 Days': 0, '4 - 7 Days': 0, '> 7 Days': 0, total: 0 },
        readyToJoin: { '< 3 Days': 0, '4 - 7 Days': 0, '> 7 Days': 0, total: 0 },
        offerWithdrawn: 0,
        joined: { yesterday: 0, mtd: 0, wtd: 0, total: 0 },
        agencySummary: {},
        stateSummary: {}
    };

    data.forEach(row => {
        let status = row['current_status'];
        if (status === 'Ready to Offer') status = 'Ready to offer';
        
        const agency = row['agency'] || 'Unknown';
        const state = row['requisition State'] || 'Unknown';
        
        let targetDateStr = row['has Approved Date'];
        let isMMDDYYYY = false;
        if (targetDateStr) isMMDDYYYY = true;
        else {
            targetDateStr = row['last_activity_on'];
            isMMDDYYYY = false;
        }
        const dateObj = parseDate(targetDateStr, isMMDDYYYY);
        const diffDays = getDaysDifference(dateObj);

        if (!metrics.agencySummary[agency]) {
            metrics.agencySummary[agency] = { appInterview: 0, ha: 0, offerReleased: 0, offerWithdrawn: 0, joined: 0, total: 0 };
        }
        if (!metrics.stateSummary[state]) {
            metrics.stateSummary[state] = { appInterview: 0, ha: 0, offerReleased: 0, offerWithdrawn: 0, joined: 0, total: 0 };
        }

        const addAgencyState = (category) => {
            metrics.agencySummary[agency][category]++;
            metrics.agencySummary[agency].total++;
            metrics.stateSummary[state][category]++;
            metrics.stateSummary[state].total++;
        };

        if (status === 'Face To Face Interview Pending' || status === 'Video Interview Pending' || status === 'F2F Completed' || status === 'VIA Feedback Pending') {
            addAgencyState('appInterview');
        } else if (status === 'Hiring Advice Generated' || status === 'HA Rejected') {
            if (status === 'Hiring Advice Generated') {
                addAgencyState('ha');
                if (diffDays >= 0) {
                    metrics.haGenerated.total++;
                    if (diffDays <= 3) metrics.haGenerated['< 3 Days']++;
                    else if (diffDays <= 7) metrics.haGenerated['3 - 7 Days']++;
                    else metrics.haGenerated['> 7 Days']++;
                }
            } else addAgencyState('appInterview');
        } else if (status === 'Ready to offer' || status === 'Ready to Join') {
            addAgencyState('offerReleased');
            if (status === 'Ready to offer') {
                metrics.readyToOffer.total++;
                if (diffDays >= 0) {
                   if (diffDays <= 3) metrics.readyToOffer['< 3 Days']++;
                   else if (diffDays <= 7) metrics.readyToOffer['4 - 7 Days']++;
                   else metrics.readyToOffer['> 7 Days']++;
                }
            } else {
                metrics.readyToJoin.total++;
                if (diffDays >= 0) {
                   if (diffDays <= 3) metrics.readyToJoin['< 3 Days']++;
                   else if (diffDays <= 7) metrics.readyToJoin['4 - 7 Days']++;
                   else metrics.readyToJoin['> 7 Days']++;
                }
            }
        } else if (status === 'Offer Withdrawn') {
            addAgencyState('offerWithdrawn');
            metrics.offerWithdrawn++;
        } else if (status === 'Joined') {
            addAgencyState('joined');
            metrics.joined.total++;
            if (diffDays === 1) metrics.joined.yesterday++;
            if (dateObj && dateObj.getMonth() === CURRENT_DATE.getMonth() && dateObj.getFullYear() === CURRENT_DATE.getFullYear()) metrics.joined.mtd++;
            if (diffDays >= 0 && diffDays <= CURRENT_DATE.getDay()) metrics.joined.wtd++;
        }
    });

    document.getElementById('kpi-yesterday').innerText = metrics.joined.yesterday;
    document.getElementById('kpi-mtd').innerText = metrics.joined.mtd;
    document.getElementById('kpi-wtd').innerText = metrics.joined.wtd;
    document.getElementById('kpi-joined-total').innerText = metrics.joined.total;
    document.getElementById('kpi-withdrawn').innerText = metrics.offerWithdrawn;

    const createAgeingHTML = (title, m, type) => `
        <div class="glass-card ageing-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="card-title text-gradient" style="margin-bottom: 0;">${title}</h3>
                <i class="ri-file-download-line export-icon" title="Export" onclick="exportOriginalData('${type}')"></i>
            </div>
            <div class="ageing-grid">
                <div class="ageing-col border-right"><p class="ageing-label">&lt; 3 Days</p><p class="ageing-value">${m['< 3 Days']}</p></div>
                <div class="ageing-col border-right"><p class="ageing-label">4 - 7 Days</p><p class="ageing-value">${m['3 - 7 Days'] || m['4 - 7 Days'] || 0}</p></div>
                <div class="ageing-col border-right"><p class="ageing-label">&gt; 7 Days</p><p class="ageing-value text-red">${m['> 7 Days']}</p></div>
                <div class="ageing-col"><p class="ageing-label">Total</p><p class="ageing-value">${m.total}</p></div>
            </div>
        </div>
    `;

    document.getElementById('ageing-tables-container').innerHTML = 
        createAgeingHTML("Hiring Advice Pending", metrics.haGenerated, 'ha') +
        createAgeingHTML("Ready To Offer", metrics.readyToOffer, 'rto') +
        createAgeingHTML("Ready To Join", metrics.readyToJoin, 'rtj');

    const createSummaryHTML = (title, summaryObj, type) => `
        <div class="glass-card summary-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="card-title text-gradient" style="margin-bottom: 0;">${title}</h3>
            </div>
            <div class="table-wrapper">
                <table class="summary-table">
                    <thead><tr><th>Name</th><th class="align-right">App & Int</th><th class="align-right">Hiring Advice</th><th class="align-right">Offer Rel</th><th class="align-right">Offer W/D</th><th class="align-right">Joined</th><th class="align-right">Total</th></tr></thead>
                    <tbody>${Object.entries(summaryObj).map(([name, stats]) => `<tr><td class="truncate" title="${name}">${name}</td><td class="align-right">${stats.appInterview}</td><td class="align-right">${stats.ha}</td><td class="align-right">${stats.offerReleased}</td><td class="align-right">${stats.offerWithdrawn}</td><td class="align-right">${stats.joined}</td><td class="align-right bold text-blue">${stats.total}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('summary-tables-container').innerHTML = 
        createSummaryHTML("Agency-Wise Summary", metrics.agencySummary, 'agency') +
        createSummaryHTML("State-Wise Summary", metrics.stateSummary, 'state');
}

// --- POSITION RAOG LOGIC ---
const posBuildId = document.getElementById('pos-build-id');
const posWorkArea = document.getElementById('pos-work-area');
const posJobRole = document.getElementById('pos-job-role');

function populatePositionFilters() {
    updateDatalists();
    posBuildId.oninput = updatePositionMetrics;
    posWorkArea.oninput = updatePositionMetrics;
    posJobRole.oninput = updatePositionMetrics;
}

function updateDatalists() {
    const bId = posBuildId.value.trim();
    const wArea = posWorkArea.value.trim();
    const jRole = posJobRole.value.trim();

    const buildIds = [...new Set(globalPositions.filter(p => 
        (!wArea || wArea === 'All' || p['WORKAREA']?.toString() === wArea) &&
        (!jRole || jRole === 'All' || p['ROLE']?.toString() === jRole)
    ).map(p => p['BUILDID']).filter(Boolean))].sort();
    
    const workAreas = [...new Set(globalPositions.filter(p => 
        (!bId || bId === 'All' || p['BUILDID']?.toString() === bId) &&
        (!jRole || jRole === 'All' || p['ROLE']?.toString() === jRole)
    ).map(p => p['WORKAREA']).filter(Boolean))].sort();

    const jobRoles = [...new Set(globalPositions.filter(p => 
        (!bId || bId === 'All' || p['BUILDID']?.toString() === bId) &&
        (!wArea || wArea === 'All' || p['WORKAREA']?.toString() === wArea)
    ).map(p => p['ROLE']).filter(Boolean))].sort();

    document.getElementById('build-list').innerHTML = buildIds.map(b => `<option value="${b}">`).join('');
    document.getElementById('work-list').innerHTML = workAreas.map(w => `<option value="${w}">`).join('');
    document.getElementById('job-list').innerHTML = jobRoles.map(j => `<option value="${j}">`).join('');
}

function updatePositionMetrics() {
    const bId = posBuildId.value.trim();
    const wArea = posWorkArea.value.trim();
    const jRole = posJobRole.value.trim();

    updateDatalists();

    // Check if any filter is actually used
    const isFiltered = (bId !== "" && bId !== "All") || 
                       (wArea !== "" && wArea !== "All") || 
                       (jRole !== "" && jRole !== "All");

    if (!isFiltered) {
        document.getElementById('raog-r').innerText = "0";
        document.getElementById('raog-a').innerText = "0";
        document.getElementById('raog-o').innerText = "0";
        document.getElementById('raog-g').innerText = "0";
        renderHireableTable([]);
        currentHireableRows = [];
        return;
    }

    filteredPositions = globalPositions.filter(p => {
        return (!bId || bId === 'All' || p['BUILDID']?.toString() === bId) &&
               (!wArea || wArea === 'All' || p['WORKAREA']?.toString() === wArea) &&
               (!jRole || jRole === 'All' || p['ROLE']?.toString() === jRole);
    });

    let rCount = filteredPositions.length;
    let aCount = 0;
    let oCount = 0;
    let gCount = 0;

    let metricsByRole = {};
    window.globalRaogData = { R: filteredPositions, A: [], O: [], G: [] };

    filteredPositions.forEach(p => {
        const canId = (p['CANDIDATEID'] || p['CANID'] || p['CAN ID'] || "").toString().trim();
        const epNo = (p['EMP NO'] || p['EP NO'] || p['EPNO'] || "").toString().trim();
        const role = p['ROLE'] || 'Unknown';

        if (!metricsByRole[role]) {
            metricsByRole[role] = { R: [], A: [], O: [], G: [] };
        }
        
        metricsByRole[role].R.push(p);

        if (epNo !== "") {
            aCount++;
            window.globalRaogData.A.push(p);
            metricsByRole[role].A.push(p);
        } else if (canId !== "") {
            oCount++;
            window.globalRaogData.O.push(p);
            metricsByRole[role].O.push(p);
        } else {
            gCount++;
            window.globalRaogData.G.push(p);
            metricsByRole[role].G.push(p);
        }
    });

    document.getElementById('raog-r').innerText = rCount;
    document.getElementById('raog-a').innerText = aCount;
    document.getElementById('raog-o').innerText = oCount;
    document.getElementById('raog-g').innerText = gCount;

    window.roleRaogData = metricsByRole;
    renderRoleCards(metricsByRole);

    document.querySelectorAll('.raog-item').forEach(el => el.classList.remove('active-filter'));

    // Default view: Gaps (Hireable)
    currentHireableRows = window.globalRaogData.G;
    renderHireableTable(currentHireableRows, "Hireable Positions (Gap)");
}

function renderRoleCards(metrics) {
    const container = document.getElementById('role-raog-container');
    container.innerHTML = Object.keys(metrics).map(role => {
        const d = metrics[role];
        return `
            <div class="role-raog-card">
                <h4 class="truncate" title="${role}">${role}</h4>
                <div class="raog-grid">
                    <div class="raog-item r-circle" onclick="filterTable('R', '${role}', event)">
                        <span class="raog-label">R</span>
                        <span class="raog-value">${d.R.length}</span>
                    </div>
                    <div class="raog-item a-circle" onclick="filterTable('A', '${role}', event)">
                        <span class="raog-label">A</span>
                        <span class="raog-value">${d.A.length}</span>
                    </div>
                    <div class="raog-item o-circle" onclick="filterTable('O', '${role}', event)">
                        <span class="raog-label">O</span>
                        <span class="raog-value">${d.O.length}</span>
                    </div>
                    <div class="raog-item g-circle" onclick="filterTable('G', '${role}', event)">
                        <span class="raog-label">G</span>
                        <span class="raog-value">${d.G.length}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.filterTable = (status, role, event) => {
    document.querySelectorAll('.raog-item').forEach(el => el.classList.remove('active-filter'));
    if (event) event.currentTarget.classList.add('active-filter');

    let rows;
    let titleStr = '';
    const statusMap = {R: 'Total Required', A: 'Available (Filled)', O: 'Offered', G: 'Gap (Hireable)'};
    
    if (role) {
        rows = window.roleRaogData[role][status] || [];
        titleStr = `${role} - ${statusMap[status]} Positions`;
    } else {
        rows = window.globalRaogData[status] || [];
        titleStr = `Organization - ${statusMap[status]} Positions`;
    }

    currentHireableRows = rows;
    renderHireableTable(rows, titleStr);
};

function renderHireableTable(rows, title) {
    const tableSection = document.getElementById('table-section');
    if (title) {
        const titleEl = tableSection.querySelector('h3');
        const countSpan = tableSection.querySelector('.subtitle');
        if (titleEl) titleEl.innerText = title;
        if (countSpan) countSpan.innerText = `Showing ${rows.length} positions based on selection.`;
    }

    const tbody = document.querySelector('#hireable-table tbody');
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${r['POSITIONCODE'] || r['Position Code'] || 'N/A'}</td>
            <td>${r['BUILDID'] || 'N/A'}</td>
            <td>${r['WORKAREA'] || 'N/A'}</td>
            <td>${r['ROLE'] || r['JOBROLE'] || 'N/A'}</td>
            <td>${r['STATE'] || r['REGION'] || 'N/A'}</td>
        </tr>
    `).join('');
}

// --- GLOBAL EXPORTS ---
window.exportPositionData = () => {
    if (currentHireableRows.length === 0) {
        alert("No hireable positions to export.");
        return;
    }
    const csv = Papa.unparse(currentHireableRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hireable_positions_export.csv`;
    link.click();
};

window.exportOriginalData = (type) => {
    // Logic from main branch preserved
    let rows = [];
    if (type === 'joined') rows = globalData.filter(r => r.current_status === 'Joined');
    else if (type === 'ha' || type === 'rto' || type === 'rtj') {
        const statuses = type === 'ha' ? ['Hiring Advice Generated'] :
                         type === 'rto' ? ['Ready to offer', 'Ready to Offer'] : ['Ready to Join'];
        rows = globalData.filter(r => statuses.includes(r.current_status)).map(row => {
            const dateStr = row['has Approved Date'] || row['last_activity_on'];
            const dateObj = parseDate(dateStr, !!row['has Approved Date']);
            const diff = getDaysDifference(dateObj);
            let ageing = 'Unknown';
            if (diff >= 0) {
                if (diff <= 3) ageing = '< 3 Days';
                else if (diff <= 7) ageing = type === 'ha' ? '3 - 7 Days' : '4 - 7 Days';
                else ageing = '> 7 Days';
            }
            return { ...row, Days: diff >= 0 ? diff : '', Ageing: ageing };
        });
    }

    else if (type === 'cumulative') {
        const statuses = ['Hiring Advice Generated', 'Ready to offer', 'Ready to Offer', 'Ready to Join'];
        const rawRows = currentFilteredData.filter(r => statuses.includes(r.current_status));
        
        rows = rawRows.map(row => {
            const newRow = { ...row };
            const st = row['current_status'];
            const cardType = st === 'Hiring Advice Generated' ? 'ha' : 
                             (st === 'Ready to offer' || st === 'Ready to Offer') ? 'rto' : 'rtj';
                             
            let targetDateStr = row['has Approved Date'];
            let isMMDDYYYY = false;
            
            if (targetDateStr) {
                isMMDDYYYY = true;
            } else {
                targetDateStr = row['last_activity_on'];
                isMMDDYYYY = false;
            }
            
            const dateObj = parseDate(targetDateStr, isMMDDYYYY);
            const diffDays = getDaysDifference(dateObj);
            
            let ageing = 'Unknown';
            if (diffDays >= 0) {
                if (diffDays <= 3) ageing = '< 3 Days';
                else if (diffDays <= 7) ageing = cardType === 'ha' ? '3 - 7 Days' : '4 - 7 Days';
                else ageing = '> 7 Days';
            }
            
            newRow['Days'] = diffDays >= 0 ? diffDays : '';
            newRow['Ageing'] = diffDays >= 0 ? ageing : '';
            return newRow;
        });
    }

    if (rows.length > 0) {
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${type}_export.csv`;
        link.click();
    }
};
