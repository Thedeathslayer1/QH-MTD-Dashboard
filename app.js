const fileInput = document.getElementById('csv-upload');
const uploadSection = document.getElementById('upload-section');
const dashboardContent = document.getElementById('dashboard-content');
const filtersContainer = document.getElementById('filters-container');
const uploadText = document.getElementById('upload-text');
const cumulativeExportContainer = document.getElementById('cumulative-export-container');

let globalData = [];
const CURRENT_DATE = new Date();
CURRENT_DATE.setHours(0,0,0,0);

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadText.innerText = "Processing...";
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                globalData = results.data;
                initializeFilters();
                renderDashboard(globalData);
                
                uploadSection.style.display = 'none';
                filtersContainer.style.display = 'flex';
                dashboardContent.style.display = 'block';
                if (cumulativeExportContainer) cumulativeExportContainer.style.display = 'block';
            },
            error: (err) => {
                uploadText.innerText = "Error parsing file.";
                console.error(err);
            }
        });
    }
});

const agencyFilter = document.getElementById('agency-filter');
const stateFilter = document.getElementById('state-filter');

const initializeFilters = () => {
    const agencies = ['All', ...new Set(globalData.map(d => d['agency']).filter(Boolean))];
    const states = ['All', ...new Set(globalData.map(d => d['requisition State']).filter(Boolean))];

    agencyFilter.innerHTML = agencies.map(a => `<option value="${a}">${a.length > 30 ? a.substring(0,30)+'...' : a}</option>`).join('');
    stateFilter.innerHTML = states.map(s => `<option value="${s}">${s}</option>`).join('');

    agencyFilter.addEventListener('change', updateFilters);
    stateFilter.addEventListener('change', updateFilters);
};

const updateFilters = () => {
    const selAgency = agencyFilter.value;
    const selState = stateFilter.value;
    
    let filtered = globalData;
    if (selAgency !== 'All') {
        filtered = filtered.filter(row => row['agency'] === selAgency);
    }
    if (selState !== 'All') {
        filtered = filtered.filter(row => row['requisition State'] === selState);
    }
    renderDashboard(filtered);
};

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
    
    if (year < 100) {
        year += 2000;
    }
    
    return new Date(year, month, day);
};

const getDaysDifference = (targetDate) => {
    if (!targetDate) return -1;
    const diffTime = Math.abs(CURRENT_DATE.getTime() - targetDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const renderDashboard = (data) => {
    let metrics = {
        haGenerated: { '< 3 Days': 0, '3 - 7 Days': 0, '> 7 Days': 0, total: 0 },
        readyToOffer: { '< 3 Days': 0, '4 - 7 Days': 0, '> 7 Days': 0, total: 0 },
        readyToJoin: { '< 3 Days': 0, '4 - 7 Days': 0, '> 7 Days': 0, total: 0 },
        offerWithdrawn: 0,
        joined: { yesterday: 0, mtd: 0, wtd: 0, total: 0 },
        agencySummary: {},
        stateSummary: {}
    };
    
    window.currentFilteredData = data;
    window.globalMetrics = metrics;

    data.forEach(row => {
        let status = row['current_status'];
        if (status === 'Ready to Offer') status = 'Ready to offer';
        
        const agency = row['agency'] || 'Unknown';
        const state = row['requisition State'] || 'Unknown';
        
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

        if (!metrics.agencySummary[agency]) {
            metrics.agencySummary[agency] = { appInterview: 0, ha: 0, offerReleased: 0, offerWithdrawn: 0, joined: 0, total: 0 };
        }
        if (!metrics.stateSummary[state]) {
            metrics.stateSummary[state] = { appInterview: 0, ha: 0, offerReleased: 0, offerWithdrawn: 0, joined: 0, total: 0 };
        }

        const addTotal = () => {
            metrics.agencySummary[agency].total++;
            metrics.stateSummary[state].total++;
        };

        const addAgencyState = (category) => {
            metrics.agencySummary[agency][category]++;
            metrics.stateSummary[state][category]++;
            addTotal();
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
            } else {
                addTotal();
            }
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
            if (dateObj && dateObj.getMonth() === CURRENT_DATE.getMonth() && dateObj.getFullYear() === CURRENT_DATE.getFullYear()) {
                metrics.joined.mtd++;
            }
            if (diffDays >= 0 && diffDays <= CURRENT_DATE.getDay()) {
               metrics.joined.wtd++;
            }
        } else {
            addAgencyState('appInterview');
        }
    });

    // Update DOM
    document.getElementById('kpi-yesterday').innerText = metrics.joined.yesterday;
    document.getElementById('kpi-mtd').innerText = metrics.joined.mtd;
    document.getElementById('kpi-wtd').innerText = metrics.joined.wtd;
    document.getElementById('kpi-joined-total').innerText = metrics.joined.total;
    document.getElementById('kpi-withdrawn').innerText = metrics.offerWithdrawn;

    const createAgeingHTML = (title, m, type) => `
        <div class="glass-card ageing-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="card-title text-gradient" style="margin-bottom: 0;">${title}</h3>
                <i class="ri-file-download-line export-icon" title="Export" onclick="exportData('${type}')"></i>
            </div>
            <div class="ageing-grid">
                <div class="ageing-col border-right">
                    <p class="ageing-label">&lt; 3 Days</p>
                    <p class="ageing-value">${m['< 3 Days']}</p>
                </div>
                <div class="ageing-col border-right">
                    <p class="ageing-label">4 - 7 Days</p>
                    <p class="ageing-value">${m['3 - 7 Days'] || m['4 - 7 Days'] || 0}</p>
                </div>
                <div class="ageing-col border-right">
                    <p class="ageing-label">&gt; 7 Days</p>
                    <p class="ageing-value text-red">${m['> 7 Days']}</p>
                </div>
                <div class="ageing-col">
                    <p class="ageing-label">Total</p>
                    <p class="ageing-value">${m.total}</p>
                </div>
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
                <i class="ri-file-download-line export-icon" title="Export" onclick="exportData('${type}')"></i>
            </div>
            <div class="table-wrapper">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th class="align-right">App & Int</th>
                            <th class="align-right">Hiring Advice</th>
                            <th class="align-right">Offer Rel</th>
                            <th class="align-right">Offer W/D</th>
                            <th class="align-right">Joined</th>
                            <th class="align-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(summaryObj).map(([name, stats]) => `
                            <tr>
                                <td class="truncate" title="${name}">${name}</td>
                                <td class="align-right">${stats.appInterview}</td>
                                <td class="align-right">${stats.ha}</td>
                                <td class="align-right">${stats.offerReleased}</td>
                                <td class="align-right">${stats.offerWithdrawn}</td>
                                <td class="align-right">${stats.joined}</td>
                                <td class="align-right bold text-blue">${stats.total}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('summary-tables-container').innerHTML = 
        createSummaryHTML("Agency-Wise Summary", metrics.agencySummary, 'agency') +
        createSummaryHTML("State-Wise Summary", metrics.stateSummary, 'state');
};

window.exportData = (type) => {
    let rows = [];
    if (!window.currentFilteredData) return;
    if (type === 'joined') {
        rows = window.currentFilteredData.filter(r => r.current_status === 'Joined');
    } else if (type === 'withdrawn') {
        rows = window.currentFilteredData.filter(r => r.current_status === 'Offer Withdrawn');
    } else if (type === 'ha' || type === 'rto' || type === 'rtj') {
        const statuses = type === 'ha' ? ['Hiring Advice Generated'] :
                         type === 'rto' ? ['Ready to offer', 'Ready to Offer'] : ['Ready to Join'];
        
        const rawRows = window.currentFilteredData.filter(r => statuses.includes(r.current_status));
        
        rows = rawRows.map(row => {
            const newRow = { ...row };
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
                else if (diffDays <= 7) ageing = type === 'ha' ? '3 - 7 Days' : '4 - 7 Days';
                else ageing = '> 7 Days';
            }
            
            newRow['Days'] = diffDays >= 0 ? diffDays : '';
            newRow['Ageing'] = diffDays >= 0 ? ageing : '';
            return newRow;
        });
    } else if (type === 'cumulative') {
        const statuses = ['Hiring Advice Generated', 'Ready to offer', 'Ready to Offer', 'Ready to Join'];
        const rawRows = window.currentFilteredData.filter(r => statuses.includes(r.current_status));
        
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
    } else if (type === 'agency' || type === 'state') {
        const summary = type === 'agency' ? window.globalMetrics.agencySummary : window.globalMetrics.stateSummary;
        rows = Object.entries(summary).map(([name, stats]) => ({
            Name: name,
            "App & Int": stats.appInterview,
            "Hiring Advice": stats.ha,
            "Offer Released": stats.offerReleased,
            "Offer Withdrawn": stats.offerWithdrawn,
            "Joined": stats.joined,
            "Total": stats.total
        }));
    }
    
    if (rows.length > 0) {
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${type}_export.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("No data available to export for this selection.");
    }
};
