let currentUser = { orderId: '', phone: '' };

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

async function checkUser() {
    const orderId = document.getElementById('orderId').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!orderId || !phone) {
        return Swal.fire({
            title: '填寫不完整',
            text: '請輸入訂單編號與手機號碼',
            icon: 'warning',
            confirmButtonColor: '#ff4757'
        });
    }

    // 檢查 CONFIG 是否有載入
    if (typeof CONFIG === 'undefined' || !CONFIG.API_URL) {
        console.error('CONFIG is missing or API_URL is empty!');
        return Swal.fire('配置錯誤', '找不到 API 設定，請檢查 config.js 是否存在。', 'error');
    }

    showLoading(true);
    console.log('Sending check request to:', CONFIG.API_URL);

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            mode: 'cors', // 明確指定 CORS
            body: JSON.stringify({ action: 'check', orderId, phone })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received data:', data);
        showLoading(false);

        if (data.success) {
            currentUser = { orderId, phone };
            document.getElementById('login-section').classList.add('hidden');

            if (data.status === 'finished') {
                showHistory(data.history);
            } else {
                renderItemList(data.items);
                document.getElementById('draw-section').classList.remove('hidden');
            }
        } else {
            Swal.fire({
                title: '驗證失敗',
                text: data.message,
                icon: 'error',
                confirmButtonColor: '#2f3542'
            });
        }
    } catch (e) {
        showLoading(false);
        console.error('Detailed API Error:', e);
        
        let errorMsg = '請確認以下幾點：\n1. 後台 GAS 是否已部署為「新版本」\n2. 存取權限是否設為「所有人 (Anyone)」\n3. 網址是否正確貼在 config.js';
        
        Swal.fire({
            title: '連線失敗',
            text: errorMsg,
            icon: 'error',
            footer: `<small>錯誤訊息: ${e.message}</small>`,
            confirmButtonColor: '#ff4757'
        });
    }
}

function renderItemList(items) {
    const container = document.getElementById('item-display');
    if (!container) return;
    let html = '<div class="item-list"><h4 style="margin-top:0;">您目前擁有的項目：</h4>';
    items.forEach(item => {
        const status = item.remaining > 0 
            ? `<span>剩餘 <b>${item.remaining}</b> 次</span>` 
            : `<span style="color:#a4b0be; text-decoration:line-through;">已全數抽完</span>`;
        html += `<div class="item-row">
            <span>${item.itemName}</span>
            ${status}
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function startDraw() {
    const btn = document.getElementById('draw-btn');
    const knob = document.getElementById('knob');
    const machine = document.getElementById('gacha-machine');

    if (!btn || !knob || !machine) return;

    btn.disabled = true;
    knob.style.transform = 'translateX(-50%) rotate(720deg)';
    machine.classList.add('shaking');

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'draw', ...currentUser })
        });
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();

        setTimeout(() => {
            machine.classList.remove('shaking');
            if (data.success) {
                let resultHtml = '<div style="text-align: left; max-height: 40vh; overflow-y: auto; padding: 10px;">';
                data.results.forEach((r, i) => {
                    resultHtml += `
                    <div style="margin-bottom: 12px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 0.8rem; color: #888;">第 ${i + 1} 抽 - ${r.itemName}</div>
                        <div style="font-weight: 700; color: #ff4757; font-size: 1.1rem;">👉 ${r.result}</div>
                    </div>`;
                });
                resultHtml += '</div>';

                Swal.fire({
                    title: '🎊 最終大獎出爐！',
                    html: resultHtml,
                    icon: 'success',
                    confirmButtonText: '查看所有歷史結果',
                    confirmButtonColor: '#ff4757',
                    allowOutsideClick: false
                }).then(() => {
                    checkUser();
                });
            } else {
                Swal.fire('糟糕', data.message, 'error');
                btn.disabled = false;
                knob.style.transform = 'translateX(-50%) rotate(0deg)';
            }
        }, 2500);
    } catch (e) {
        console.error('Draw Error:', e);
        machine.classList.remove('shaking');
        btn.disabled = false;
        knob.style.transform = 'translateX(-50%) rotate(0deg)';
        Swal.fire('系統異常', `連線發生錯誤: ${e.message}`, 'error');
    }
}

function showHistory(history) {
    const drawSection = document.getElementById('draw-section');
    const historySection = document.getElementById('history-section');
    const list = document.getElementById('history-list');
    
    if (drawSection) drawSection.classList.add('hidden');
    if (historySection) historySection.classList.remove('hidden');

    if (!list) return;

    if (!history || history.length === 0) {
        list.innerHTML = '<p style="color: #888;">尚無任何紀錄</p>';
        return;
    }

    list.innerHTML = history.slice().reverse().map(h => `
        <div class="history-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-weight: 700;">${h.itemName}</span>
                <span style="font-size: 0.8rem; color: #a4b0be;">${new Date(h.time).toLocaleTimeString()}</span>
            </div>
            <div style="color: var(--primary-color); font-weight: 700; font-size: 1.1rem;">
                ${h.option || h.result}
            </div>
        </div>
    `).join('');
}
