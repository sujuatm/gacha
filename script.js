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
            textEl.innerHTML = '目前排隊的賭徒較多 <br><span style="color:var(--accent-color); font-size:0.9rem;">(大約需要等待 10-15 秒，請勿重新整理)</span>';
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
            text: '目前使用的賭徒較多，小精靈正在努力工作，需要稍等喔！',
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

        // 確保至少旋轉 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 觸發「掉落放大」動畫
        const winningBall = document.getElementById('winning-ball');
        if (winningBall) {
            winningBall.classList.add('drop-zoom');
            // 等待掉落動畫完成 (0.8s 動畫 + 一點緩衝)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        container.classList.remove('is-spinning', 'is-loading');

        if (data.success) {
            if (winningBall) winningBall.classList.remove('drop-zoom');
            
            // 相同項目加總邏輯
            const groupedMap = {};
            data.results.forEach(r => {
                const key = `${r.itemName}|${r.result}`;
                if (!groupedMap[key]) {
                    groupedMap[key] = { ...r, count: 0 };
                }
                groupedMap[key].count++;
            });
            const groupedArray = Object.values(groupedMap);

            let resultHtml = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-height: 50vh; overflow-y: auto; padding: 5px;">';
            groupedArray.forEach((r) => {
                const imgPath = r.imgFile ? `images/rewards/${r.imgFile}` : `images/svg/ball_single.svg`;
                resultHtml += `
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 10px; text-align: center; border: 1px solid #eee;">
                        <div style="width: 100%; aspect-ratio: 1/1; margin-bottom: 8px; background:white; border-radius:8px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                            <img src="${imgPath}" style="width:100%; height:100%; object-fit:cover;" 
                                 onerror="this.src='images/svg/ball_single.svg'; this.style.opacity='0.3';">
                        </div>
                        <div style="font-size: 0.85rem; font-weight:700; color:#2f3542; word-break:break-all;">
                            ${r.itemName} ${r.result} <br> <span style="color:#ff4757;">${r.count}個</span>
                        </div>
                    </div>`;
            });
            resultHtml += '</div>';

            Swal.fire({
                title: '🎊抽獎出爐🎊',
                html: resultHtml,
                icon: 'success',
                confirmButtonText: '查看抽獎紀錄',
                confirmButtonColor: '#ff4757',
                allowOutsideClick: false
            }).then(() => {
                if (data.history) {
                    showHistory(data.history);
                } else {
                    checkUser();
                }
                btn.disabled = false;
            });
        } else {
            Swal.fire({
                title: '糟糕',
                html: data.message.replace(/\n/g, '<br>'),
                icon: 'error'
            });
            btn.disabled = false;
        }
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

// 更新結果顯示區域 (改為圖片網格版)
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

    // 格式化時間 (僅顯示一次在最上方)
    const latestTime = history.length > 0 ? formatDate(history[0].time) : '';

    let html = `<div class="reward-time-header">最後更新：${latestTime}</div>`;
    html += '<div class="reward-grid">';

    // 相同項目加總邏輯
    const groupedMap = {};
    history.forEach(h => {
        const optionName = h.option || h.result;
        const key = `${h.itemName}|${optionName}`;
        if (!groupedMap[key]) {
            groupedMap[key] = { ...h, optionName: optionName, count: 0 };
        }
        groupedMap[key].count++;
    });
    const groupedHistory = Object.values(groupedMap);

    groupedHistory.forEach(h => {
        // 如果有指定圖片檔名，路徑設為 images/rewards/，否則顯示通用扭蛋佔位符
        const imgPath = h.imgFile
            ? `images/rewards/${h.imgFile}`
            : `images/svg/ball_single.svg`;

        const imgClass = h.imgFile ? 'reward-img' : 'reward-img reward-placeholder';

        html += `
            <div class="reward-card">
                <div class="reward-img-container">
                    <img src="${imgPath}" class="${imgClass}" loading="lazy" 
                         onerror="this.src='images/svg/ball_single.svg'; this.classList.add('reward-placeholder');">
                </div>
                <div class="reward-name">
                    ${h.itemName} ${h.optionName} <br> <span style="color:#ff4757;">${h.count}個</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    list.innerHTML = html;
}

// 輔助函式：日期格式化 (MM/DD HH:mm)
function formatDate(isoString) {
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return isoString;
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const date = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${month}/${date} ${hours}:${minutes}`;
}
