// Global variables for file handling
let selectedFile = null;
let extractedEmail = null; // 이력서에서 추출한 이메일 저장용

// Drag and drop event listeners
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileBadge = document.getElementById('file-badge');
const fileNameText = document.getElementById('file-name-text');

// 💡 인위적인 시간차 메세지 전환을 위한 딜레이 헬퍼 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// [최종본] 이메일 자동 추출 반영 및 순차 로딩 핸들러
// ==========================================
async function handleSubmit(e) {
    e.preventDefault();
    
    // 1. 파일 선택 여부 검증
    if (!selectedFile) {
        alert('분석할 이력서 파일을 업로드해 주세요.');
        return;
    }
    
    // 2. DOM 엘리먼트 값 추출
    const address = document.getElementById('user-address').value;

    // 💡 [추가된 부분] 주소 누락 즉시 차단 (서버로 보내기도 전에 컷!)
    if (!address || address.trim() === '') {
        alert('희망 기준 주소를 반드시 검색해서 입력해 주세요.');
        return;
    }
    
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;
    const maxDistance = document.getElementById('distance-range').value;
    const career = document.getElementById('career-filter').value;
    const education = document.getElementById('education-filter').value;
    const webhookUrl = '/api/sync';
    
    // 3. 이메일 값 최종 결정 (이력서 자동 추출값 우선, 없으면 수동 입력값 사용)
    let finalEmail = extractedEmail;
    
    if (!finalEmail) {
        const manualEmail = document.getElementById('user-email').value.trim();
        const manualEmailConfirm = document.getElementById('user-email-confirm').value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(manualEmail)) {
            alert('올바른 이메일 형식(예: example@email.com)을 입력해 주세요.');
            document.getElementById('user-email').focus(); 
            return;
        }
        
        if (manualEmail !== manualEmailConfirm) {
            alert('❌ 입력하신 두 이메일 주소가 일치하지 않습니다. 오타가 없는지 다시 확인해 주세요.');
            document.getElementById('user-email-confirm').focus(); 
            return;
        }
        finalEmail = manualEmail;
    }
    
    // 4. 로딩 오버레이 작동 및 초기화
    const overlay = document.getElementById('loading-overlay');
    const overlayTitle = document.getElementById('overlay-status-title');
    const overlayDesc = document.getElementById('overlay-status-desc');
    overlay.style.display = 'flex';
    
    // 메시지 제어용 플래그
    let isCommunicationDone = false;
    
    try {
        // [1단계] 파일 처리
        overlayTitle.textContent = "문서 검증 중...";
        overlayDesc.textContent = "업로드하신 이력서 파일의 무결성을 체크하고 있습니다.";
        const fileData = await getFileData(selectedFile);
        await delay(1200); // 문구 인지 딜레이
        
        if (isCommunicationDone) return;

        // [2단계] 페이로드 조립 및 전송 준비
        overlayTitle.textContent = "보안 터널 연결 중...";
        overlayDesc.textContent = "ngrok 게이트웨이를 통해 로컬 인프라와 안전한 통신을 수립합니다.";
        const payload = {
            email: finalEmail,
            address: address,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            max_distance_km: parseInt(maxDistance),
            career: career,
            education: education,
            resume: {
                filename: selectedFile.name,
                content_type: selectedFile.type,
                data_base64: fileData.base64,
                text_content: fileData.text 
            }
        };
        await delay(1500);

        if (isCommunicationDone) return;

        // [3단계] 백엔드 통신과 메시지 스케줄러를 동시에 병렬 실행 (Promise.all)
        overlayTitle.textContent = "AI 엔진 분석 가동...";
        overlayDesc.textContent = "Dify LLM 모델이 이력서 본문을 분석하여 적합성을 평가하고 있습니다.";

        // 백엔드 비동기 요청 시작
        const fetchPromise = fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // 통신이 지연될 때 화면 문구를 지속적으로 바꾸어주는 스케줄러
        const messageScheduler = async () => {
            if (isCommunicationDone) return;
            await delay(3500); 
            if (isCommunicationDone) return;
            overlayTitle.textContent = "구인 정보 매칭 중...";
            overlayDesc.textContent = "설정하신 반경 및 경력 필터를 기반으로 실시간 데이터 매핑을 실행합니다.";

            await delay(3500); 
            if (isCommunicationDone) return;
            overlayTitle.textContent = "최종 검증 및 저장 중...";
            overlayDesc.textContent = "분석 결과를 데이터베이스에 바인딩하고 알림 동기화를 마무리합니다.";
        };

        // 통신과 메시지 변경을 동시에 달리게 하되, 응답을 최우선으로 대기
        const [response] = await Promise.all([fetchPromise, messageScheduler()]);
        
        isCommunicationDone = true; 
        const responseData = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            const errorReason = responseData.message || "올바른 형식의 이력서 파일이 아닙니다.";
            throw new Error(errorReason);
        }
        
        // 성공 시 UI 상태 업데이트
        overlay.innerHTML = `
            <i class="fa-solid fa-circle-check" style="font-size: 4.5rem; color: var(--secondary-color); text-shadow: 0 0 25px var(--secondary-glow); margin-bottom: 0.5rem;"></i>
            <div class="overlay-text" style="font-size: 1.7rem; font-weight: 800; color: var(--secondary-color); letter-spacing: -0.02em; margin-bottom: 0.5rem;">매칭 등록 완료!</div>
            <div class="overlay-subtext" style="text-align: center; max-width: 85%; line-height: 1.6; font-size: 1.15rem; color: #0f172a; font-weight: 500; background: rgba(5, 150, 105, 0.06); border: 1px solid rgba(5, 150, 105, 0.18); padding: 1.4rem; border-radius: 16px; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.05);">
                이력서 분석 및 구독 등록이 완료되었습니다.<br>
                매일 아침 8시 입력하신 메일(<strong style="color: var(--primary-color); font-weight: 800; text-decoration: underline;">${finalEmail}</strong>)로<br/>
                맞춤 구인 정보를 발송해 드립니다.
            </div>
            <button class="btn-primary" onclick="resetForm()" style="margin-top: 0; padding: 0.8rem 3rem; font-size: 1.05rem; width: auto; border-radius: 12px; box-shadow: 0 8px 20px var(--primary-glow);">확인</button>
        `;
        
    } catch (error) {
        isCommunicationDone = true;
        console.error(error);
        // 가독성을 극대화한 흰색 글자 고정형 에러 박스 반영
        overlay.innerHTML = `
            <i class="fa-solid fa-circle-xmark" style="font-size: 4rem; color: #ef4444; text-shadow: 0 0 20px rgba(239, 68, 68, 0.4);"></i>
            <div class="overlay-text" style="color: #ef4444;">등록 실패</div>
            <div class="overlay-subtext" style="text-align: center; max-width: 80%; line-height: 1.6; color: #fca5a5; font-size: 1.1rem; font-weight: 500;">
                알림: ${error.message}<br><br>
                <span style="font-size: 1rem; color: #ffffff; display: block; background: #334155; padding: 0.8rem; border-radius: 8px; font-weight: 500; margin-top: 0.5rem; line-height: 1.6;">
                    정확한 이력서 문서(PDF/TXT)를 선택했는지 확인하시고,<br/>문제가 지속되면 웹훅 엔드포인트(/sync) 상태를 검증하세요.
                </span>
            </div>
            <button class="btn-secondary" onclick="closeOverlay()" style="margin-top: 1.5rem; background: #475569; color: #fff; padding: 0.6rem 2rem; border-radius: 8px;">다시 시도</button>
        `;
    }
}

// 1. Drag and Drop Interaction
['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
    }, false);
});

dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
});

function triggerFileInput() {
    if (selectedFile) return;
    fileInput.click();
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// 이력서를 즉시 스캔하여 이메일을 찾아내는 메인 로직
async function processFile(file) {
    const validExtensions = ['pdf', 'txt'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        alert('지원하지 않는 파일 형식입니다. PDF 또는 TXT 파일만 업로드 가능합니다.');
        return;
    }
    
    selectedFile = file;
    fileNameText.textContent = file.name;
    fileBadge.style.display = 'inline-flex';
    toggleDropzoneContent(false);
    
    // 텍스트 추출 및 정규식 이메일 스캔
    try {
        const fileData = await getFileData(file);
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = fileData.text.match(emailRegex);
        
        const emailGroup1 = document.getElementById('email-input-container');
        const emailGroup2 = document.getElementById('email-confirm-container');
        const badge = document.getElementById('extracted-email-badge');
        const badgeText = document.getElementById('extracted-email-text');
        
        if (match && match[1]) {
            extractedEmail = match[1];
            // 이메일 찾음: 수동 입력창 숨기고 성공 뱃지 띄움
            if(emailGroup1) emailGroup1.style.display = 'none';
            if(emailGroup2) emailGroup2.style.display = 'none';
            if(badge) {
                badge.style.display = 'flex';
                badgeText.textContent = `이메일 자동인식: ${extractedEmail}`;
            }
        } else {
            extractedEmail = null;
            // 이메일 못 찾음: 수동 입력창 나타나게 함
            if(emailGroup1) emailGroup1.style.display = 'block';
            if(emailGroup2) emailGroup2.style.display = 'block';
            if(badge) badge.style.display = 'none';
            alert("이력서 본문에서 이메일 주소를 찾지 못했습니다. 아래에 수신용 이메일을 직접 입력해 주세요.");
        }
    } catch(e) {
        extractedEmail = null;
        const emailGroup1 = document.getElementById('email-input-container');
        const emailGroup2 = document.getElementById('email-confirm-container');
        if(emailGroup1) emailGroup1.style.display = 'block';
        if(emailGroup2) emailGroup2.style.display = 'block';
    }
}

function clearFile(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    selectedFile = null;
    extractedEmail = null; // 이메일 데이터 초기화
    fileInput.value = '';
    fileBadge.style.display = 'none';
    
    // 파일 지우면 수동입력창과 뱃지도 전부 초기화하여 숨김
    const emailGroup1 = document.getElementById('email-input-container');
    const emailGroup2 = document.getElementById('email-confirm-container');
    const badge = document.getElementById('extracted-email-badge');
    
    if(emailGroup1) emailGroup1.style.display = 'none';
    if(emailGroup2) emailGroup2.style.display = 'none';
    if(badge) badge.style.display = 'none';
    
    toggleDropzoneContent(true);
}

function toggleDropzoneContent(showDefault) {
    const icon = dropzone.querySelector('.dropzone-icon');
    const text = dropzone.querySelector('.dropzone-text');
    const subtext = dropzone.querySelector('.dropzone-subtext');
    
    if (showDefault) {
        icon.style.display = 'inline-block';
        text.style.display = 'block';
        subtext.style.display = 'block';
        dropzone.style.pointerEvents = 'auto';
    } else {
        icon.style.display = 'none';
        text.style.display = 'none';
        subtext.style.display = 'none';
    }
}

// 2. Distance range slider label update
function updateDistanceVal(val) {
    document.getElementById('distance-display').textContent = `${val} km`;
}

// 3. Kakao Postcode (우편번호 서비스) Integration
function openAddressSearch() {
    try {
        console.log("Kakao Postcode API Popup Opening...");
        new daum.Postcode({
            oncomplete: function(data) {
                try {
                    console.log("Address selected raw data:", data);
                    let fullAddr = data.address;
                    let extraAddr = '';
                    
                    if (data.addressType === 'R') {
                        if (data.bname !== '') {
                            extraAddr += data.bname;
                        }
                        if (data.buildingName !== '') {
                            extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName);
                        }
                        fullAddr += (extraAddr !== '' ? ' (' + extraAddr + ')' : '');
                    }
                    
                    const addrInput = document.getElementById('user-address');
                    if (addrInput) {
                        addrInput.value = fullAddr;
                        console.log("Successfully injected address:", fullAddr);
                    } else {
                        console.error("Target address input field (#user-address) not found!");
                    }
                    
                    simulateGeocoding(fullAddr);
                } catch (innerError) {
                    console.error("Error during address processing:", innerError);
                    alert("주소 데이터를 가져오는 중 내부 오류가 발생했습니다. 개발자 도구(F12) 콘솔을 확인해 주세요.");
                }
            },
            onclose: function(state) {
                console.log("Address popup closed. State:", state);
            }
        }).open();
    } catch (outerError) {
        console.error("Failed to initialize Kakao Postcode object:", outerError);
        alert("카카오 우편번호 서비스를 초기화하지 못했습니다. 네트워크 연결 및 인터넷 상태를 확인해 주세요.");
    }
}

function simulateGeocoding(address) {
    try {
        if (!address) {
            console.warn("simulateGeocoding received empty address");
            return;
        }
        let lat = 37.5565;
        let lon = 126.9780;
        
        if (address.includes('부산')) {
            lat = 35.1796; lon = 129.0756;
        } else if (address.includes('대구')) {
            lat = 35.8714; lon = 128.6014;
        } else if (address.includes('인천')) {
            lat = 37.4563; lon = 126.7052;
        } else if (address.includes('광주')) {
            lat = 35.1595; lon = 126.8526;
        } else if (address.includes('대전')) {
            lat = 36.3504; lon = 127.3845;
        } else if (address.includes('울산')) {
            lat = 35.5384; lon = 129.3114;
        } else if (address.includes('경기')) {
            lat = 37.2636; lon = 127.0286;
        } else if (address.includes('제주')) {
            lat = 33.4996; lon = 126.5312;
        }
        
        const seed = address.length % 10;
        lat += (seed - 5) * 0.008;
        lon += (seed - 5) * 0.008;
        
        const latInput = document.getElementById('latitude');
        const lonInput = document.getElementById('longitude');
        
        if (latInput && lonInput) {
            latInput.value = lat.toFixed(6);
            lonInput.value = lon.toFixed(6);
            console.log(`Geocoding Result -> Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`);
        } else {
            console.error("Latitude/Longitude hidden inputs not found!");
        }
    } catch (err) {
        console.error("Error in simulateGeocoding:", err);
    }
}

// 4. Advanced Settings Toggle (Accordion)
function toggleSettings() {
    const header = document.getElementById('settings-accordion-header');
    const content = document.getElementById('settings-accordion-content');
    
    header.classList.toggle('active');
    content.classList.toggle('open');
}

// Helper function to read file (Supports both TXT and PDF text extraction)
function getFileData(file) {
    return new Promise((resolve, reject) => {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === 'pdf') {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const arrayBuffer = e.target.result;
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = "";
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(" ");
                        fullText += pageText + "\n";
                    }
                    
                    const base64Reader = new FileReader();
                    base64Reader.onload = function(evt) {
                        const base64String = evt.target.result.split(',')[1] || evt.target.result;
                        resolve({
                            base64: base64String,
                            text: fullText.trim()
                        });
                    };
                    base64Reader.readAsDataURL(file);
                    
                } catch (pdfError) {
                    console.error("PDF text extraction failed:", pdfError);
                    reject(new Error("PDF 파일에서 텍스트를 추출하는 데 실패했습니다. 파일 손상 여부를 확인하세요."));
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
            
        } else if (fileExtension === 'txt') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const rawResult = e.target.result;
                const base64String = rawResult.split(',')[1] || rawResult;
                
                const textReader = new FileReader();
                textReader.onload = function(evt) {
                    resolve({
                        base64: base64String,
                        text: evt.target.result
                    });
                };
                textReader.onerror = (err) => reject(err);
                textReader.readAsText(file);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        } else {
            reject(new Error("지원하지 않는 파일 형식입니다."));
        }
    });
}

function closeOverlay() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="overlay-text" id="overlay-status-title">이력서 분석 중...</div>
        <div class="overlay-subtext" id="overlay-status-desc">Dify AI와 Activepieces를 통해 선호도를 연동하는 중입니다.</div>
    `;
}

function resetForm() {
    closeOverlay();
    document.getElementById('matching-form').reset();
    clearFile();
    updateDistanceVal(20); // 초기 자차 기준 디폴트값 동기화
    const savedUrl = localStorage.getItem('activepieces_webhook_url');
    const webhookInput = document.getElementById('webhook-url');
    if (savedUrl && webhookInput) {
        webhookInput.value = savedUrl;
    }
}

// 페이지 초기 로드 시 저장된 URL이 있으면 불러오기
document.addEventListener('DOMContentLoaded', () => {
    const savedUrl = localStorage.getItem('activepieces_webhook_url');
    const webhookInput = document.getElementById('webhook-url');
    if (savedUrl && webhookInput) {
        webhookInput.value = savedUrl;
        console.log("로컬 스토리지에서 웹훅 URL을 불러왔습니다:", savedUrl);
    }
});

// 웹훅 URL 저장 함수
function saveWebhookUrl() {
    const webhookInput = document.getElementById('webhook-url');
    if (webhookInput) {
        const url = webhookInput.value.trim();
        if (!url) {
            alert('웹훅 URL을 입력해 주세요.');
            return;
        }
        try {
            new URL(url);
        } catch (_) {
            alert('올바른 URL 형식이 아닙니다. 프로토콜(http:// 또는 https://)을 포함하여 다시 입력해 주세요.');
            return;
        }
        localStorage.setItem('activepieces_webhook_url', url);
        alert('웹훅 URL이 저장되었습니다! 이제 페이지를 새로고침하거나 다시 접속해도 입력한 주소가 유지됩니다.');
    }
}
// 유저가 수동으로 다른 이메일 입력을 원할 때 호출되는 함수
function overrideEmail() {
    extractedEmail = null; // AI가 추출했던 이메일 메모리에서 삭제
    
    // 자동인식 뱃지 숨기기
    const badge = document.getElementById('extracted-email-badge');
    if (badge) badge.style.display = 'none';
    
    // 수동 입력창 다시 보여주기
    const emailGroup1 = document.getElementById('email-input-container');
    const emailGroup2 = document.getElementById('email-confirm-container');
    if (emailGroup1) emailGroup1.style.display = 'block';
    if (emailGroup2) emailGroup2.style.display = 'block';
    
    // 유저가 바로 타자를 칠 수 있도록 입력창에 포커스 주기
    const emailInput = document.getElementById('user-email');
    if (emailInput) emailInput.focus();
}