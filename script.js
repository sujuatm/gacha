let currentUser = { orderId: '', phone: '' };

let loadingTimer = null;

function showLoading(show, initialMsg = '正在連線...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = overlay.querySelector('p');

    // 清除舊的定時器
    if (loadingTimer) clearTimeout(loadingTimer);

    if (show) {
        overlay.style.display = 'flex';
        textEl.innerText = initialMsg;

        // 如果超過 4 秒還在載入，切換提示文字
        loadingTimer = setTimeout(() => {
            textEl.innerHTML = '目前排隊欸噗較多 <br><span style="color:var(--accent-color); font-size:0.9rem;">(大約需要等待 10-15 秒，請勿重新整理)</span>';
        }, 4000);
    } else {
        overlay.style.display = 'none';
        textEl.innerText = '正在連線...';
    }
}

async function checkUser() {
    const orderId = document.getElementById('orderId').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!orderId || !phone) {
        return Swal.fire({
            title: '哎呀！',
            text: '請填寫完整的訂單資料喔',
            icon: 'warning',
            confirmButtonColor: '#ff4757'
        });
    }

    // 檢查 CONFIG 是否有載入
    if (typeof CONFIG === 'undefined' || !CONFIG.API_URL) {
        return Swal.fire('配置錯誤', '找不到 API 設定', 'error');
    }

    showLoading(true, '驗證中請稍等');

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'check', orderId, phone })
        });

        const data = await res.json();
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
                title: '查無資料',
                html: data.message.replace(/\n/g, '<br>'),
                icon: 'error',
                confirmButtonColor: '#2f3542'
            });
        }
    } catch (e) {
        showLoading(false);
        console.error('Detailed API Error:', e);
        Swal.fire({
            title: '連線失敗',
            text: `無法取得資料，請確認後台 API 是否正確部署為「新版本」且權限設為「所有人」。\n(錯誤：${e.message})`,
            icon: 'error',
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
    const container = document.getElementById('gacha-container');

    if (!btn || !container) return;

    btn.disabled = true;
    
    // 執行新版動畫：旋鈕旋轉 + 整機與球體晃動
    container.classList.add('is-spinning', 'is-loading');

    // 抽獎時也顯示 Loading 提示，防止等待焦慮
    let drawQueueTimer = setTimeout(() => {
        Swal.fire({
            title: '排隊抽獎中',
            text: '目前使用欸噗較多，小精靈正在努力工作，需要稍等喔！',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }, 6000);

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'draw', ...currentUser })
        });

        // 完成後清除所有排隊提示
        clearTimeout(drawQueueTimer);
        if (Swal.isVisible() && Swal.getTitle().innerText.includes('排隊')) {
            Swal.close();
        }

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();

        setTimeout(() => {
            container.classList.remove('is-spinning', 'is-loading');
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
                    title: '🎊抽獎出爐🎊',
                    html: resultHtml,
                    icon: 'success',
                    confirmButtonText: '查看所有歷史結果',
                    confirmButtonColor: '#ff4757',
                    allowOutsideClick: false
                }).then(() => {
                    // 如果後台有回傳最新歷史，直接顯示，避免再次連網連到「連線失敗」
                    if (data.history) {
                        showHistory(data.history);
                    } else {
                        checkUser();
                    }
                });
            } else {
                Swal.fire({
                    title: '糟糕', 
                    html: data.message.replace(/\n/g, '<br>'), 
                    icon: 'error'
                });
                btn.disabled = false;
            }
        }, 1500);
    } catch (e) {
        clearTimeout(drawQueueTimer);
        if (Swal.isVisible()) Swal.close();
        console.error('Draw Fetch Error:', e);
        container.classList.remove('is-spinning', 'is-loading');
        btn.disabled = false;
        Swal.fire({
            title: '系統異常',
            text: `執行過程中發生阻礙: ${e.message}`,
            icon: 'error'
        });
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

    list.innerHTML = history.slice().reverse().map(h => {
        const dateObj = new Date(h.time);
        const timeStr = isNaN(dateObj.getTime()) ? '剛剛' : dateObj.toLocaleTimeString();
        return `
            <div class="history-card">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: 700;">${h.itemName}</span>
                    <span style="font-size: 0.8rem; color: #a4b0be;">${timeStr}</span>
                </div>
                <div style="color: var(--primary-color); font-weight: 700; font-size: 1.1rem;">
                    ${h.option || h.result}
                </div>
            </div>
        `;
    }).join('');
}
