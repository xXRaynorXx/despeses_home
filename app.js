const DB_NAME = 'ControlGastosExcelMatrizDB';
const DB_VERSION = 1;
const STORE_NAME = 'despeses';
let db;

const DADES_EXCEL = [
  { "date": "2021-04-15", "concept": "Aigua", "amount": 40.29, "notes": "Excel" },
  { "date": "2021-04-15", "concept": "Parking", "amount": 65.00, "notes": "" },
  { "date": "2021-04-15", "concept": "Neteja", "amount": 40.00, "notes": "" },
  { "date": "2021-05-28", "concept": "Aigua", "amount": 40.00, "notes": "" },
  { "date": "2021-05-28", "concept": "Llum (Naturgy)", "amount": 38.00, "notes": "" },
  { "date": "2021-05-28", "concept": "Gas", "amount": 25.50, "notes": "" },
  { "date": "2021-05-28", "concept": "Parking", "amount": 65.00, "notes": "" },
  { "date": "2021-05-28", "concept": "Telèfon", "amount": 40.00, "notes": "" },
  { "date": "2021-06-08", "concept": "Aigua", "amount": 18.67, "notes": "" },
  { "date": "2021-06-08", "concept": "Parking", "amount": 65.00, "notes": "" },
  { "date": "2021-06-08", "concept": "Telèfon", "amount": 40.00, "notes": "" },
  { "date": "2021-07-15", "concept": "Aigua", "amount": 36.63, "notes": "" },
  { "date": "2021-07-15", "concept": "Llum (Naturgy)", "amount": 77.00, "notes": "" },
  { "date": "2021-07-15", "concept": "Gas", "amount": 22.00, "notes": "" },
  { "date": "2021-07-15", "concept": "Parking", "amount": 65.00, "notes": "" },
  { "date": "2021-07-15", "concept": "Telèfon", "amount": 41.00, "notes": "" },
  { "date": "2022-01-04", "concept": "Aigua", "amount": 33.31, "notes": "" },
  { "date": "2022-01-04", "concept": "Llum (Naturgy)", "amount": 46.72, "notes": "" },
  { "date": "2022-01-04", "concept": "Gas", "amount": 75.17, "notes": "" },
  { "date": "2022-01-04", "concept": "Parking", "amount": 65.00, "notes": "" },
  { "date": "2022-12-05", "concept": "Securitas", "amount": 48.56, "notes": "Alta" },
  { "date": "2022-12-05", "concept": "Neteja", "amount": 24.53, "notes": "" }
];

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (e) => {
    const store = e.target.result.createObjectStore(
        STORE_NAME, { keyPath: 'id', autoIncrement: true }
    );
    store.createIndex('date', 'date', { unique: false });
    store.createIndex('concept', 'concept', { unique: false });
};

request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

function initApp() {
    populateYears();
    setDefaultDates();
    setupEventListeners();
    importarDadesDirectes();
}

function populateYears() {
    const select = document.getElementById('filter-year');
    const current = new Date().getFullYear();
    for (let i = current; i >= current - 5; i--) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = i; select.appendChild(opt);
    }
    select.value = "2021";
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T');
    document.getElementById('date').value = today;
    document.getElementById('chart-start-date').value = '2021-01-01';
    document.getElementById('chart-end-date').value = today;
}

function setupEventListeners() {
    document.getElementById('expense-form').addEventListener('submit', saveExpense);
    document.getElementById('btn-cancel').addEventListener('click', resetForm);
    // Escoltador per al nou botó d'eliminar del formulari
    document.getElementById('btn-form-delete').addEventListener('click', () => {
        const id = document.getElementById('expense-id').value;
        if (id) window.deleteExpense(parseInt(id));
    });
    document.getElementById('filter-year').addEventListener('change', loadData);
    document.getElementById('chart-concept').addEventListener('change', updateChartData);
    document.getElementById('chart-start-date').addEventListener('change', updateChartData);
    document.getElementById('chart-end-date').addEventListener('change', updateChartData);
}

function importarDadesDirectes() {
    if (localStorage.getItem('import_matriz_fet') === 'true') {
        loadData(); return;
    }
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    DADES_EXCEL.forEach(g => store.add(g));
    tx.oncomplete = () => {
        localStorage.setItem('import_matriz_fet', 'true');
        loadData();
    };
}

function saveExpense(e) {
    e.preventDefault();
    const id = document.getElementById('expense-id').value;
    const concept = document.getElementById('concept').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('date').value;
    const notes = document.getElementById('notes').value.trim();

    const data = { concept, amount, date, notes };
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    if (id) {
        data.id = parseInt(id);
        store.put(data).onsuccess = () => { resetForm(); loadData(); };
    } else {
        store.add(data).onsuccess = () => { resetForm(); loadData(); };
    }
}

function loadData() {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const list = [];
    
    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { 
            list.push(cursor.value); 
            cursor.continue(); 
        } else { 
            renderTableAndStats(list); 
            updateConceptSelector(list); 
        }
    };
}

function renderTableAndStats(list) {
    const year = parseInt(document.getElementById('filter-year').value);
    const tbody = document.getElementById('expenses-table-body');
    tbody.innerHTML = '';

    let totalGlobal = 0;
    let countGlobal = 0;
    const matriuGastos = {};

    list.forEach(item => {
        if (!item.date) return;
        
        const parts = item.date.split('-'); 
        const expYear = parseInt(parts[0]);
        const expMonth = parseInt(parts[1]) - 1; 

        if (expYear === year) {
            totalGlobal += item.amount;
            countGlobal++;

            const concepte = item.concept;
            if (!matriuGastos[concepte]) {
                matriuGastos[concepte] = Array(12).fill(null);
            }
            matriuGastos[concepte][expMonth] = item;
        }
    });

    const conceptesUnics = Object.keys(matriuGastos).sort();

    if (conceptesUnics.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;
            padding:20px;color:var(--text-light)">
            No hi ha registres per a aquest any</td></tr>`;
    }

    conceptesUnics.forEach(concepte => {
        const row = document.createElement('tr');
        let filaHTML = `<td>${escapeHTML(concepte)}</td>`;
        
        for (let mes = 0; mes < 12; mes++) {
            const dadaGasto = matriuGastos[concepte][mes];
            if (dadaGasto) {
                const notaText = dadaGasto.notes ? ` (${dadaGasto.notes})` : '';
                filaHTML += `<td class="excel-amount" 
                    title="${escapeHTML(dadaGasto.concept)}${escapeHTML(notaText)}"
                    onclick="editExpense(${dadaGasto.id})">
                    ${dadaGasto.amount.toFixed(1)}€
                </td>`;
            } else {
                filaHTML += `<td class="excel-empty">-</td>`;
            }
        }
        row.innerHTML = filaHTML;
        tbody.appendChild(row);
    });

    document.getElementById('total-selected').textContent = `${totalGlobal.toFixed(2)} €`;
    document.getElementById('count-selected').textContent = countGlobal;
}

window.deleteExpense = function(id) {
    if (confirm('Vols eliminar aquest registre?')) {
        db.transaction([STORE_NAME], 'readwrite')
          .objectStore(STORE_NAME).delete(id).onsuccess = () => loadData();
    }
};

window.editExpense = function(id) {
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id).onsuccess = (e) => {
        const item = e.target.result;
        document.getElementById('expense-id').value = item.id;
        document.getElementById('concept').value = item.concept;
        document.getElementById('amount').value = item.amount;
        document.getElementById('date').value = item.date;
        document.getElementById('notes').value = item.notes || '';
        
        document.getElementById('form-title').textContent = "Modificar Despesa ✏️";
        document.getElementById('btn-submit').textContent = "Actualitzar Cambis";
        
        // Mostrem els botons de cancel·lar i eliminar
        document.getElementById('btn-cancel').style.display = 'block';
        document.getElementById('btn-form-delete').style.display = 'block';
    };
}

function resetForm() {
    document.getElementById('expense-form').reset();
    document.getElementById('expense-id').value = '';
    document.getElementById('form-title').textContent = "Registrar Despesa";
    document.getElementById('btn-submit').textContent = "Guardar Despesa";
    
    // Amaguem els botons auxiliars
    document.getElementById('btn-cancel').style.display = 'none';
    document.getElementById('btn-form-delete').style.display = 'none';
    setDefaultDates();
}

function updateConceptSelector(list) {
    const select = document.getElementById('chart-concept');
    const current = select.value;
    const concepts = [...new Set(list.map(i => i.concept))].sort();
    select.innerHTML = '';
    concepts.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c; select.appendChild(opt);
    });
    if (current && concepts.includes(current)) select.value = current;
    updateChartData();
}

function updateChartData() {
    const concept = document.getElementById('chart-concept').value;
    const start = document.getElementById('chart-start-date').value;
    const end = document.getElementById('chart-end-date').value;
    if (!concept) return;

    const list = [];
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME)
      .openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            const item = cursor.value;
            if (item.concept === concept && item.date >= start && item.date <= end) {
                list.push(item);
            }
            cursor.continue();
        } else { renderNativeChart(list); }
    };
}

function renderNativeChart(points) {
    const container = document.getElementById('native-chart');
    container.innerHTML = '';
    if (points.length === 0) {
        container.innerHTML = 'Sense dades';
        return;
    }
    
    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    const maxAmount = Math.max(...points.map(p => p.amount), 1);

    points.forEach((p, i) => {
        const barHeightPercent = (p.amount / maxAmount) * 70;
        let incMarkup = '';
        
        if (i > 0) {
            const prev = points[i - 1].amount;
            if (prev > 0) {
                const pct = ((p.amount - prev) / prev) * 100;
                if (pct > 0) {
                    incMarkup = `<span style="color:var(--danger)" ` +
                        `class="chart-bar-inc">▲+${pct.toFixed(0)}%</span>`;
                } else if (pct < 0) {
                    incMarkup = `<span style="color:var(--success)" ` +
                        `class="chart-bar-inc">▼${pct.toFixed(0)}%</span>`;
                } else {
                    incMarkup = `<span style="color:var(--text-light)" ` +
                        `class="chart-bar-inc">=0%</span>`;
                }
            }
        } else { 
            incMarkup = 'Inici'; 
        }

        const dateLabel = p.date.split('-').reverse().slice(0, 2).join('/');
        const barWrapper = document.createElement('div');
        barWrapper.className = 'chart-bar-wrapper';
        barWrapper.innerHTML = `
            <div class="chart-bar-value">${p.amount.toFixed(1)}€</div>
            <div class="chart-bar-fill" style="height: ${barHeightPercent}%"></div>
            <div class="chart-bar-label">${dateLabel}</div>
            ${incMarkup}
        `;
        container.appendChild(barWrapper);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, t => ({
        '&': '&amp;', 
        '<': '&lt;', 
        '>': '&gt;', 
        "'": '&#39;', 
        '"': '&quot;'
    }[t] || t));
}
