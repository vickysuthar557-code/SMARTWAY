// ==========================================
// SMARTWAY CORE CONFIG & INITIALIZATION (2026)
// ==========================================
const SB_URL = 'https://secygumgnuortsdgouiq.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY3lndW1nbnVvcnRzZGdvdWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjYyOTAsImV4cCI6MjA5NDE0MjI5MH0.w9fWEwFmflmsKXj_Boqv2DE95OTw4As97dQ_F8SAXN0';

let sb;
if (typeof supabase !== 'undefined') {
    sb = supabase.createClient(SB_URL, SB_KEY);
    window.sb = sb; 
} else {
    console.error("Supabase CDN library missing!");
}

// STRICT MATCHING: FIXED PACKAGE CONFIGURATIONS FROM YOUR ORIGINAL LOGIC
const miningConfigs = {
    '100':                 { cycle: 2,   cap: 10,   name: 'Trial' },
    'Trial Package — ₹100': { cycle: 2,   cap: 10,   name: 'Trial' }, 
    '1000':                { cycle: 10,  cap: 100,  name: 'Bronze' },
    '2000':                { cycle: 15,  cap: 75,   name: 'Silver' }, 
    '3000':                { cycle: 30,  cap: 300,  name: 'Gold' },
    '5000':                { cycle: 50,  cap: 400,  name: 'Platinum' },
    '10000':               { cycle: 110, cap: 500,  name: 'Diamond' }
};

// ==========================================
// ANTI-CHEAT: MULTI-DEVICE SESSION MIDDLEWARE
// ==========================================
async function verifyActiveDeviceSession(uid) {
    const localToken = localStorage.getItem('session_crypto_key');
    if(!localToken) return false;

    const { data, error } = await sb.from('users').select('utr_number').eq('id', uid).single();
    if (data && data.utr_number && data.utr_number.startsWith('TOKEN:')) {
        const currentActiveDBToken = data.utr_number.replace('TOKEN:', '');
        if (currentActiveDBToken !== localToken) {
            alert("Security Alert: This account is logged into another device. Access Revoked.");
            window.logout();
            return false;
        }
    }
    return true;
}

// ==========================================
// REALTIME UPI LINKING & QR GENERATION
// ==========================================
window.loadRegisterSettings = async () => {
    const upiDisplay = document.getElementById('live-upi-id');
    const displayAmtEl = document.getElementById('display-amt');
    const pkgSelect = document.getElementById('package-select');

    try {
        if(!sb) return;
        const { data: settingsArray, error } = await sb
            .from('app_settings')
            .select('admin_upi')
            .order('id', { ascending: false }) 
            .limit(1);

        if (!error && settingsArray && settingsArray.length > 0) {
            const settings = settingsArray[0];
            if (upiDisplay && settings.admin_upi) {
                upiDisplay.innerText = `UPI: ${settings.admin_upi}`;
            }
            if(pkgSelect && displayAmtEl) {
                displayAmtEl.innerText = pkgSelect.value;
                const qrImg = document.getElementById('admin-qr');
                if (qrImg) {
                    const qrData = `upi://pay?pa=${settings.admin_upi}&am=${pkgSelect.value}&cu=INR&tn=SmartwayPlan${pkgSelect.value}`;
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
                }
            }
        }
    } catch (err) {
        console.error("Failed to compile operational settings pipeline:", err);
    }
};

// ==========================================
// AUTOMATIC DAILY LIMIT RESET ENGINE (12 AM)
// ==========================================
async function checkAndResetDailyLimit(user) {
    if (!user) return user;
    const todayStr = new Date().toLocaleDateString('en-CA'); 

    if (user.last_reset_date !== todayStr) {
        const { data: updatedUser, error } = await sb
            .from('users')
            .update({
                daily_mined_today: 0,
                last_reset_date: todayStr
            })
            .eq('id', user.id)
            .select()
            .single();

        if (!error && updatedUser) {
            return updatedUser;
        }
    }
    return user;
}

// ==========================================
// AUTHENTICATION & SESSION MANAGEMENT
// ==========================================
window.handleRegistration = async () => {
    const name = document.getElementById('reg-name')?.value;
    const phone = document.getElementById('reg-phone')?.value;
    const pass = document.getElementById('reg-password')?.value;
    const ref = document.getElementById('reg-referrer-id')?.value;
    const pkg = document.getElementById('package-select')?.value;
    const utr = document.getElementById('trans-details')?.value;

    if(!name || !phone || !pass || !utr) return alert("Please fill in all the required details to register.");

    const todayStr = new Date().toLocaleDateString('en-CA');

    const { error } = await sb.from('users').insert([{
        full_name: name, phone_number: phone, password_hash: pass,
        referrer_id: ref || null, package_id: pkg, utr_number: utr,
        is_approved: false, wallet_balance: 0, mining_balance: 0, 
        daily_mined_today: 0, last_reset_date: todayStr,
        rate_boost: 0, cap_boost: 0, total_earned_till_date: 0, is_degraded: false
    }]);

    if(error) {
        alert("Registration Failed: " + error.message);
    } else {
        alert("Registration successful! Please wait for admin approval.");
        window.location.href = 'index.html';
    }
};

window.handleUserLogin = async () => {
    const phone = document.getElementById('login-phone')?.value;
    const pass = document.getElementById('login-password')?.value;

    if(!phone || !pass) return alert("Please enter both your phone number and password.");

    const { data, error } = await sb.from('users').select('*').eq('phone_number', phone).eq('password_hash', pass).maybeSingle();

    if(data) {
        if(!data.is_approved) return alert("Your account is currently pending approval from the admin.");
        
        const uniqueToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();
        await sb.from('users').update({ utr_number: `TOKEN:${uniqueToken}` }).eq('id', data.id);
        
        localStorage.clear();
        localStorage.setItem('user_id', data.id);
        localStorage.setItem('is_admin', data.is_admin);
        localStorage.setItem('user_phone', data.phone_number);
        localStorage.setItem('session_crypto_key', uniqueToken); 
        
        window.location.href = 'dashboard.html';
    } else {
        alert("Invalid credentials! Please check your details and try again.");
    }
};

window.logout = () => {
    localStorage.clear();
    window.location.href = 'index.html';
};

// ==========================================
// DYNAMIC 3X LIMIT & DEGRADED CALCULATOR ENGINE (RE-BUILT FOR TRIAL COMMISSION)
// ==========================================
async function calculateFinalPower(user) {
    if (!user) return { finalRate: 10, finalCap: 100 }; 
    
    // Rule 1: Agar account degraded hai, toh direct minimal limit return karein
    if (user.is_degraded === true) {
        return { finalRate: 2, finalCap: 10 }; 
    }

    let baseRate = 10;
    let baseCap = 100;

    // Rule 2: Check for Trial Package User
    if (user.package_id === '100' || user.package_id === 'Trial Package — ₹100' || user.package_id === 100) {
        console.log("Current user is on Trial Plan. Allowing base limits + referral rewards.");
        // Trial ki asli base limits setup karein
        baseRate = 2; 
        baseCap = 10;
    } else {
        // Real paid packages ke liye config file se base rate aur cap uthein
        const config = miningConfigs[user.package_id] || miningConfigs['100'];
        baseRate = config.cycle || 10;
        baseCap = config.cap || 100;
    }

    // Rule 3: FINAL MATHEMATICAL ADDITION (SABHI USERS KE LIYE)
    // Ab chahe user Trial ho ya Paid, use referral networks se mila hua rate_boost aur cap_boost milega!
    let finalRate = baseRate + (parseFloat(user.rate_boost) || 0);
    let finalCap = baseCap + (parseFloat(user.cap_boost) || 0);
    
    return { finalRate, finalCap };
}
// ==========================================
// DASHBOARD NAVIGATION & DATA ENGINE
// ==========================================
window.loadDashboardData = async () => {
    const uid = localStorage.getItem('user_id');
    if(!uid) return;

    const secureSessionActive = await verifyActiveDeviceSession(uid);
    if(!secureSessionActive) return;

    let { data: user, error } = await sb.from('users').select('*').eq('id', uid).single();
    
    if(user) {
        user = await checkAndResetDailyLimit(user);

        const warningBox = document.getElementById('account-degraded-warning');
        if (warningBox) {
            warningBox.style.display = user.is_degraded ? 'block' : 'none';
        }

        if(document.getElementById('wallet-balance')) document.getElementById('wallet-balance').innerText = `₹${user.wallet_balance.toFixed(2)}`;
        if(document.getElementById('coin-count')) document.getElementById('coin-count').innerText = user.mining_balance.toFixed(2);
        
        const currentPlanText = document.getElementById('current-user-plan');
        if(currentPlanText) {
            const currentConf = miningConfigs[user.package_id] || { name: 'Trial' };
            currentPlanText.innerText = user.is_degraded ? "Trial (Degraded 3X)" : currentConf.name;
        }
        
        const power = await calculateFinalPower(user);
        const totalCap = parseFloat(power.finalCap) || 100;
        const totalMined = parseFloat(user.daily_mined_today) || 0;
        const safeCapLeft = Math.max(0, totalCap - totalMined);

        if(document.getElementById('cap-left')) {
            document.getElementById('cap-left').innerText = safeCapLeft.toFixed(2);
            document.getElementById('cap-left').style.color = safeCapLeft <= 0 ? "#ff4444" : "#22c55e";
        }
        if(document.getElementById('cap-max')) document.getElementById('cap-max').innerText = totalCap;
        if(document.getElementById('rate-info')) document.getElementById('rate-info').innerText = `Rate: ${power.finalRate} Coins / Cycle`;
        
        // Dynamic Sync Withdrawal Form Text Fields
        const { data: settings } = await sb.from('app_settings').select('min_withdrawal, max_withdrawal').single();
        if(settings) {
            const minW = settings.min_withdrawal || 100;
            const maxW = settings.max_withdrawal || 10000;
            const targetField = document.getElementById('withdraw-amount');
            if(targetField) {
                targetField.placeholder = `Enter Amount (₹${minW} - ₹${maxW})`;
            }
        }
    }
};

// ==========================================
// ECONOMY & COIN CONVERSION (SECURE RPC BACKEND)
// ==========================================
window.processCustomSell = async () => {
    const uid = localStorage.getItem('user_id');
    const inputAmt = parseFloat(document.getElementById('custom-sell-amount').value);

    if (isNaN(inputAmt) || inputAmt <= 0) return alert("Please enter a valid coin amount.");

    const secureSessionActive = await verifyActiveDeviceSession(uid);
    if(!secureSessionActive) return;

    const { error } = await sb.rpc('secure_process_sell', { 
        p_user_id: uid, 
        p_sell_amount: inputAmt 
    });

    if (!error) {
        alert(`Success! ${inputAmt} Coins sold successfully.`);
        document.getElementById('sell-coins-modal').style.display = 'none';
        location.reload();
    } else {
        alert("Transaction Failed: " + error.message);
    }
};

// ==========================================
// REALTIME CHART CONTROLLER
// ==========================================
window.currentChartTimeframe = '1M'; 
window.chartIntervalEngine = null;

window.startChartLoop = async () => {
    if(window.chartIntervalEngine) clearInterval(window.chartIntervalEngine);

    const rateDisplay = document.getElementById('current-coin-rate-text');
    if(!rateDisplay) return;

    let updateSpeed = 3000; 
    if(window.currentChartTimeframe === '5M') updateSpeed = 15000; 
    if(window.currentChartTimeframe === '1H') updateSpeed = 60000; 

    window.chartIntervalEngine = setInterval(async () => {
        const { data: settings } = await sb.from('app_settings').select('coin_rate').single();
        if(settings) {
            const base = parseFloat(settings.coin_rate) || 1.0;
            
            const minMove = 0.30;
            const maxMove = 0.50;
            const randomGap = minMove + (Math.random() * (maxMove - minMove)); 
            const direction = Math.random() > 0.5 ? 1 : -1; 
            
            const liveRate = parseFloat((base + (direction * randomGap)).toFixed(2));
            rateDisplay.innerText = `₹${liveRate.toFixed(2)}`;
            
            if (window.liveChart) {
                let currentData = [...window.liveChart.data.datasets[0].data];
                let currentLabels = [...window.liveChart.data.labels];
                
                currentData.shift(); 
                currentData.push(liveRate); 
                
                currentLabels.shift();
                currentLabels.push(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

                window.liveChart.data.datasets[0].data = currentData;
                window.liveChart.data.labels = currentLabels;
                window.liveChart.update('none'); 
            }
        }
    }, updateSpeed);
};

window.changeTimeframe = async (timeframe, element) => {
    window.currentChartTimeframe = timeframe;
    
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = '#64748b';
    });
    if(element) {
        element.classList.add('active');
        element.style.color = 'white';
    }

    let limitCount = 10; 
    if(timeframe === '5M') limitCount = 30; 
    if(timeframe === '1H') limitCount = 60; 

    try {
        const { data: historyData, error } = await sb
            .from('rate_history')
            .select('rate, created_at') 
            .order('id', { ascending: false })
            .limit(limitCount);

        if (!error && historyData && historyData.length > 0 && window.liveChart) {
            let points = historyData.map(h => parseFloat(h.rate)).reverse();
            
            let labels = historyData.map(h => {
                if(h.created_at) {
                    return new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                return '';
            }).reverse();

            window.liveChart.data.datasets[0].data = points;
            window.liveChart.data.labels = labels;
            window.liveChart.update();
        }
    } catch(e) { 
        console.error("Timeframe history load fail:", e); 
    }

    window.startChartLoop();
};

// ==========================================
// PACKAGE UPGRADE CHANNELS
// ==========================================
window.updateUpgradePaymentQR = async () => {
    const upiDisplay = document.getElementById('upgrade-live-upi');
    const displayAmtEl = document.getElementById('upgrade-display-amt');
    const pkgSelect = document.getElementById('modal-package-select');
    const qrImg = document.getElementById('upgrade-admin-qr');

    if(!pkgSelect || !displayAmtEl) return;
    displayAmtEl.innerText = pkgSelect.value;

    let adminUPI = "ssm@ybl"; 
    const { data } = await sb.from('app_settings').select('admin_upi').single();
    if(data && data.admin_upi) adminUPI = data.admin_upi;

    if(upiDisplay) upiDisplay.innerText = `UPI: ${adminUPI}`;
    if(qrImg) {
        const qrData = `upi://pay?pa=${adminUPI}&am=${pkgSelect.value}&cu=INR&tn=UpgradePlan${pkgSelect.value}`;
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
    }
};

window.submitUpgradeRequest = async () => {
    const uid = localStorage.getItem('user_id');
    const newPkg = document.getElementById('modal-package-select').value;
    const utr = document.getElementById('upgrade-utr-input').value;

    if(!utr || utr.trim().length < 6) return alert("Please enter a valid transaction UTR reference ID.");

    const { data: user } = await sb.from('users').select('package_id').eq('id', uid).single();

    const { error } = await sb.from('upgrade_requests').insert([{
        user_id: uid,
        old_package: user.package_id,
        new_package: newPkg,
        utr_number: utr,
        status: 'pending'
    }]);

    if(!error) {
        alert("Upgrade request submitted successfully! Admin will verify it within 60 minutes.");
        document.getElementById('upgrade-plan-modal').style.display = 'none';
    } else {
        alert("Failed to submit request: " + error.message);
    }
};

// ==========================================
// ADMIN EXTENSION MODULES
// ==========================================
window.loadAdminUpgradeRequests = async () => {
    const list = document.getElementById('upgrade-request-list');
    if(!list) return;

    const { data, error } = await sb.from('upgrade_requests').select('*, users(full_name, phone_number)').eq('status', 'pending');
    
    if(data && data.length > 0) {
        list.innerHTML = data.map(u => `
            <tr>
                <td><b>${u.users?.full_name || 'N/A'}</b><br><small>${u.users?.phone_number || 'N/A'}</small></td>
                <td>₹${u.old_package} -> <b style="color:#22c55e">₹${u.new_package}</b></td>
                <td style="color:#ff8c00; font-weight:bold;">${u.utr_number}</td>
                <td>
                    <button class="btn-s btn-app" onclick="window.approveUpgrade('${u.id}', '${u.user_id}', '${u.new_package}')">APPROVE</button>
                    <button class="btn-s btn-rej" onclick="window.rejectUpgrade('${u.id}')">REJECT</button>
                </td>
            </tr>
        `).join('');
    } else {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending upgrade files.</td></tr>';
    }
};

window.approveUpgrade = async (requestId, userId, newPackage) => {
    if(!confirm("Approve this profile plan tier upgrade?")) return;
    
    const { error: err1 } = await sb.from('upgrade_requests').update({ status: 'approved' }).eq('id', requestId);
    
    const { error: err2 } = await sb.from('users').update({
        package_id: newPackage,
        is_approved: true,
        is_degraded: false,               
        total_earned_till_date: 0          
    }).eq('id', userId);

    if(!err1 && !err2) {
        alert("Upgrade successful! User profile tier limits unlocked.");
        window.loadAdminUpgradeRequests();
    } else {
        alert("Processing mismatch error intercepted.");
    }
};

window.rejectUpgrade = async (requestId) => {
    if(!confirm("Reject this upgrade receipt?")) return;
    const { error } = await sb.from('upgrade_requests').update({ status: 'rejected' }).eq('id', requestId);
    if(!error) { alert("Rejected!"); window.loadAdminUpgradeRequests(); }
};

window.updateGlobalRate = async () => {
    const rate = parseFloat(document.getElementById('new-coin-rate').value);
    if(isNaN(rate)) { alert("Please enter a valid rate."); return; }
    
    const { data: settings } = await sb.from('app_settings').select('*').single();
    
    let history = settings.rate_history || [];
    history.push({ time: new Date().toLocaleTimeString(), rate: rate });
    if(history.length > 15) history.shift();

    await sb.from('app_settings').update({ coin_rate: rate, rate_history: history }).eq('id', settings.id);

    const { error } = await sb.from('rate_history').insert([{ rate: rate }]);

    if(!error) alert("Global Rate Updated & Synced to Live Graphs!");
    else alert("Error updating rate: " + error.message);
};

const originalShowTab = window.showTab;
window.showTab = function(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById('tab-' + tabId);
    if(targetTab) targetTab.classList.remove('hidden');
    if(el) el.classList.add('active');
    
    if(tabId === 'approvals') window.loadAdminApprovals();
    if(tabId === 'withdrawals') window.loadAdminWithdrawals();
    if(tabId === 'settings') window.loadAdminSettings();
    if(tabId === 'upgrades') window.loadAdminUpgradeRequests(); 
};


// ==========================================
// MINING ENGINE CONTROL (SECURE BACKEND RUNTIME)
// ==========================================
window.startMiningCycle = async () => {
    const uid = localStorage.getItem('user_id');
    if(!uid) return alert("Session expired. Please login again.");

    const secureSessionActive = await verifyActiveDeviceSession(uid);
    if(!secureSessionActive) return;

    const { data: active } = await sb.from('mining_sessions').select('*').eq('user_id', uid).eq('is_active', true).maybeSingle();
    if(active) return alert("Your mining cycle is already active!");

    let { data: user } = await sb.from('users').select('*').eq('id', uid).single();
    user = await checkAndResetDailyLimit(user);
    
    const power = await calculateFinalPower(user);
    const currentMined = user.daily_mined_today ? parseFloat(user.daily_mined_today) : 0;
    const maxAllowedCap = power.finalCap ? parseFloat(power.finalCap) : 100;

    if(maxAllowedCap > 0 && currentMined >= maxAllowedCap) {
        return alert("You have reached your daily mining limit for today!");
    }

    const fixedRate = parseFloat(power.finalRate) || 10;
    const endTime = new Date(Date.now() + 30 * 60000); 
    
    const { error } = await sb.from('mining_sessions').insert([{
        user_id: uid, 
        end_time: endTime.toISOString(), 
        potential_coins: fixedRate, 
        is_active: true
    }]);

    if(!error) {
        alert("Mining Started! 🚀");
        location.reload();
    } else {
        alert(error.message);
    }
};

window.checkActiveMining = async () => {
    const uid = localStorage.getItem('user_id');
    if(!uid) return; 
    
    const { data: session } = await sb.from('mining_sessions').select('*').eq('user_id', uid).eq('is_active', true).maybeSingle();

    if(session) {
        const timerBox = document.getElementById('cycle-timer-box');
        const timerText = document.getElementById('timer-text');
        if(timerBox) timerBox.style.display = 'block';

        if(window.miningInterval) clearInterval(window.miningInterval);

        window.miningInterval = setInterval(async () => {
            const now = new Date().getTime();
            const end = new Date(session.end_time).getTime();
            const diff = end - now;

            if(diff <= 0) {
                clearInterval(window.miningInterval);
                window.miningInterval = null; 
                if(timerText) timerText.innerText = "00:00";
                await window.claimMiningReward(session);
            } else {
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                if(timerText) timerText.innerText = `${mins}:${secs < 10 ? '0'+secs : secs}`;
            }
        }, 1000);
    }
};

window.claimMiningReward = async (session) => {
    const uid = localStorage.getItem('user_id');
    if(!uid || session.user_id !== uid) return; 

    if(window.isClaimingInProgress === true) return;
    window.isClaimingInProgress = true;

    const secureSessionActive = await verifyActiveDeviceSession(uid);
    if(!secureSessionActive) {
        window.isClaimingInProgress = false;
        return;
    }

    try {
        const { error: rpcSecureErr } = await sb.rpc('secure_claim_mining_reward', {
            p_session_id: session.id,
            p_user_id: uid
        });

        if (rpcSecureErr) {
            alert("Mining Verification Failed: " + rpcSecureErr.message);
            window.isClaimingInProgress = false;
            location.reload();
            return;
        }
        
        const potentialCoins = parseFloat(session.potential_coins) || 10;

        const { error: rpcErr } = await sb.rpc('distribute_passive_income', { 
            p_claimant_id: session.user_id, 
            p_amount_mined: potentialCoins 
        });

        if (rpcErr) console.error("Passive Income Network Error:", rpcErr.message);

        alert(`Success! ${potentialCoins} Coins claimed successfully.`);
        window.isClaimingInProgress = false;
        location.reload();
    } catch (e) {
        console.error("Error in claim mining reward:", e);
        window.isClaimingInProgress = false;
        location.reload();
    }
};

// ==========================================
// FUND WITHDRAWAL TRACKER WITH DYNAMIC RANGE
// ==========================================
window.submitWithdrawal = async () => {
    const uid = localStorage.getItem('user_id');
    const amt = parseFloat(document.getElementById('withdraw-amount')?.value);
    const holder = document.getElementById('bank-holder')?.value;
    const acc = document.getElementById('bank-account')?.value;
    const ifsc = document.getElementById('bank-ifsc')?.value;

    if(!amt || !holder || !acc || !ifsc) return alert("Please fill in complete bank details.");
    
    // Fetch Dynamic Admin Range Controls 
    const { data: settings } = await sb.from('app_settings').select('min_withdrawal, max_withdrawal').single();
    const minAllowed = settings ? parseInt(settings.min_withdrawal) : 100;
    const maxAllowed = (settings && settings.max_withdrawal) ? parseInt(settings.max_withdrawal) : 10000;
    
    if(amt < minAllowed) return alert(`Minimum withdrawal requirement is ₹${minAllowed}.`);
    if(amt > maxAllowed) return alert(`Maximum withdrawal limit per request is ₹${maxAllowed}.`);
    
    const { data: user } = await sb.from('users').select('wallet_balance').eq('id', uid).single();
    if(user.wallet_balance < amt) return alert("Insufficient wallet balance for this withdrawal request.");

    // FIXED: Strict JSON Object mapping for Supabase JSON/Object field
    const bankObj = { "holder": holder, "acc": acc, "ifsc": ifsc };
    
    const { error } = await sb.from('withdrawals').insert([{
        user_id: uid, 
        amount: amt, 
        bank_details: bankObj, 
        status: 'pending'
    }]);

    if(!error) {
        await sb.from('users').update({ wallet_balance: user.wallet_balance - amt }).eq('id', uid);
        alert("Withdrawal Request successful!");
        location.reload();
    } else {
        alert("Error: " + error.message);
    }
};

window.loadHistory = async () => {
    const uid = localStorage.getItem('user_id');
    const container = document.getElementById('history-list');
    if(!container) return;

    const { data } = await sb.from('withdrawals').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if(data && data.length > 0) {
        container.innerHTML = data.map(w => {
            let bankAccount = 'N/A';
            
            // FIXED: Safe Parsing for Stringified JSON or direct Object
            if (w.bank_details) {
                try {
                    let details = typeof w.bank_details === 'string' ? JSON.parse(w.bank_details) : w.bank_details;
                    const rawAcc = details.acc || details.account || '';
                    if(rawAcc) bankAccount = `****${String(rawAcc).slice(-4)}`;
                } catch(e) {
                    console.error("Error parsing bank details:", e);
                }
            }
            
            let formattedDate = 'Recent';
            if(w.created_at) {
                const d = new Date(w.created_at);
                formattedDate = d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
            
            return `
                <div class="history-item" style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="hist-info">
                        <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">₹${parseFloat(w.amount).toFixed(2)}</div>
                        <small style="color: #64748b; font-size: 11px; display: block; margin-top: 2px;">Acc: ${bankAccount}</small>
                        <small style="color: #94a3b8; font-size: 10px; display: block; margin-top: 1px;"><i class="far fa-clock"></i> ${formattedDate}</small>
                    </div>
                    <span class="status-pill status-${w.status}" style="text-transform: uppercase; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">${w.status}</span>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `<div class="empty-state" style="text-align: center; padding: 15px; color: #64748b;"><p>No transactions found.</p></div>`;
    }
};

// ==========================================
// 10-LEVEL DOWNLINE SYSTEM MATRIX
// ==========================================
window.loadMultiLevelTeam = async () => {
    const teamListEl = document.getElementById('team-list');
    const totalCountEl = document.getElementById('total-members-count');
    if (!teamListEl) return;

    const userPhone = localStorage.getItem('user_phone'); 
    if (!userPhone) return;

    try {
        const { data: allUsers, error } = await sb.from('users').select('full_name, phone_number, referrer_id');
        if (error) throw error;

        let fullDownline = [];
        let currentLevelParents = [userPhone]; 

        for (let level = 1; level <= 10; level++) {
            if (currentLevelParents.length === 0) break;
            const levelMembers = allUsers.filter(u => currentLevelParents.includes(u.referrer_id));
            if (levelMembers.length === 0) break;

            levelMembers.forEach(member => {
                fullDownline.push({
                    name: member.full_name || "Unknown User",
                    phone: member.phone_number,
                    level: level
                });
            });
            currentLevelParents = levelMembers.map(m => m.phone_number);
        }

        if (fullDownline.length === 0) {
            teamListEl.innerHTML = '<p style="text-align:center; color:#64748b;">No members yet.</p>';
            totalCountEl.innerText = "0";
            return;
        }

        totalCountEl.innerText = fullDownline.length;
        teamListEl.innerHTML = ""; 

        fullDownline.forEach(member => {
            const hiddenPhone = member.phone ? member.phone.toString().substring(0, 4) + "****" : "N/A";
            const badgeClass = member.level <= 5 ? `lvl-${member.level}` : 'lvl-5';
            const memberCard = `
                <div class="member-item">
                    <div>
                        <div style="font-weight: 800; font-size: 16px; margin-bottom: 3px;">${member.name}</div>
                        <div style="font-size: 13px; color: #64748b; font-weight: 600;">${hiddenPhone}</div>
                    </div>
                    <span class="lvl-badge ${badgeClass}">Level ${member.level}</span>
                </div>
            `;
            teamListEl.insertAdjacentHTML('beforeend', memberCard);
        });
    } catch (err) { console.error(err); }
};

if (localStorage.getItem('user_id') && window.location.pathname.includes('dashboard.html')) { 
    window.checkActiveMining(); 
}

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('live-upi-id')) { window.loadRegisterSettings(); }
});
