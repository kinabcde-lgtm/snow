let map;
let markers = [];
let parsedBoxes = [];
let currentList = []; // 현재 필터로 표시 중인 제설함 목록

// 주소에서 구 / 동 추출 (예: "경기도 수원시 장안구 율전동 123-4")
function parseAddress(addr) {
  if (!addr) return { gu: "", dong: "" };

  const parts = addr.trim().split(/\s+/);
  let gu = "";
  let dong = "";

  if (parts.length >= 4) {
    // 예: [경기도, 수원시, 장안구, 율전동, 123-4]
    if (parts[2].endsWith("구") || parts[2].endsWith("군")) {
      gu = parts[2];
      dong = parts[3];
    } else {
      // 예: [경기도, 의왕시, 삼동, 200-1] (구가 없는 시)
      gu = "";
      dong = parts[2];
    }
  } else if (parts.length >= 3) {
    gu = "";
    dong = parts[2];
  }

  // "율전동123-4" → "율전동"만 남기기
  dong = dong.replace(/\d.*$/, "");
  dong = dong.replace(/[^가-힣0-9]/g, "");

  return { gu, dong };
}

function initData() {
  try {
    if (typeof snowBoxes === "undefined" || !Array.isArray(snowBoxes)) {
      alert("snowBoxes.js가 제대로 연결되지 않았습니다. 파일명/경로를 확인해 주세요.");
      console.error(
        "snowBoxes 값:",
        typeof snowBoxes === "undefined" ? "undefined" : snowBoxes
      );
      return;
    }
  } catch (e) {
    alert("snowBoxes.js를 읽는 중 오류가 발생했습니다. 콘솔을 확인해 주세요.");
    console.error(e);
    return;
  }

  console.log("snowBoxes 로드 완료, 개수:", snowBoxes.length);

  parsedBoxes = snowBoxes.map((b) => {
    const { gu, dong } = parseAddress(b.addr || "");
    return {
      ...b,
      gu,
      dong,
      lat: b.lat != null ? parseFloat(b.lat) : null,
      lng: b.lng != null ? parseFloat(b.lng) : null
    };
  });
}

function initMap() {
  if (!window.kakao || !kakao.maps) {
    console.error(
      "kakao.maps가 정의되지 않았습니다. (키/도메인/카카오맵 활성화 설정 확인 필요)"
    );
    alert(
      "카카오 지도 스크립트가 로드되지 않았습니다. JS 키, 도메인, 카카오맵 ON 여부를 확인해 주세요."
    );
    return;
  }

  const container = document.getElementById("map");
  const options = {
    center: new kakao.maps.LatLng(37.413294, 127.518304), // 경기도 대략 중심
    level: 9
  };
  map = new kakao.maps.Map(container, options);
}

function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
}

// 제설함 마커 표시 + 마커 클릭 시 해당 위치로 이동/줌인 + 네비 링크
function renderMarkers(data) {
  clearMarkers();
  const countEl = document.getElementById("count");
  countEl.textContent = `표시 제설함: ${data.length}개`;

  if (!data.length || !map) return;

  const bounds = new kakao.maps.LatLngBounds();

  data.forEach((b) => {
    if (b.lat == null || b.lng == null) return;

    const pos = new kakao.maps.LatLng(b.lat, b.lng);

    const marker = new kakao.maps.Marker({
      position: pos,
      map
    });
    markers.push(marker);
    bounds.extend(pos);

    // 네비용 장소 이름 & URL
    const placeName = `${b.sigunNm} ${b.gu ? b.gu + " " : ""}${b.dong}`;
    const naviUrl = `https://map.kakao.com/link/to/${encodeURIComponent(
      placeName
    )},${b.lat},${b.lng}`;

    const infoHtml = `
      <div style="padding:6px 8px;font-size:12px;">
        <b>${placeName}</b><br/>
        ${b.addr}<br/>
        ${b.detail ? `상세: ${b.detail}<br/>` : ""}
        ${b.manager ? `관리기관: ${b.manager}<br/>` : ""}
        <a href="${naviUrl}" target="_blank"
           style="color:#2563eb;text-decoration:none;font-weight:600;">
          ▶ 카카오맵 길찾기 열기
        </a>
      </div>
    `;
    const infowindow = new kakao.maps.InfoWindow({ content: infoHtml });

    // 마커 클릭 → 해당 위치로 이동 + 고정 확대(레벨 5) + 말풍선
    kakao.maps.event.addListener(marker, "click", () => {
      map.panTo(pos);
      map.setLevel(5); // 항상 5레벨로 맞춤
      infowindow.open(map, marker);
    });
  });

  // 현재 필터된 제설함들이 한 번에 보이도록
  map.setBounds(bounds);
}

function initFilters() {
  const citySelect = document.getElementById("citySelect");
  const dongSelect = document.getElementById("dongSelect");
  const dongSearchInput = document.getElementById("dongSearchInput");
  const dongSearchBtn = document.getElementById("dongSearchBtn");

  if (!parsedBoxes.length) {
    console.warn("parsedBoxes가 비어있습니다.");
    return;
  }

  // 1) 시/군 옵션 만들기
  const citySet = new Set(parsedBoxes.map((b) => b.sigunNm));
  [...citySet].sort().forEach((city) => {
    const opt = document.createElement("option");
    opt.value = city;
    opt.textContent = city;
    citySelect.appendChild(opt);
  });

  // 2) 시/군에 따라 동 옵션 재구성
  function updateDongOptions() {
    const city = citySelect.value;
    dongSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "전체";
    dongSelect.appendChild(optAll);

    let list = parsedBoxes;
    if (city) {
      list = list.filter((b) => b.sigunNm === city);
    }

    const dongSet = new Set(list.map((b) => b.dong).filter(Boolean));
    [...dongSet].sort().forEach((d) => {
      const option = document.createElement("option");
      option.value = d;
      option.textContent = d;
      dongSelect.appendChild(option);
    });
  }

  // 3) 선택값 + 검색어에 따라 필터 적용
  function applyFilter() {
    const city = citySelect.value;
    const dong = dongSelect.value;
    const searchRaw = dongSearchInput ? dongSearchInput.value.trim() : "";
    const search = searchRaw.replace(/\s+/g, ""); // 공백 제거

    let list = parsedBoxes;

    if (city) list = list.filter((b) => b.sigunNm === city);
    if (dong) list = list.filter((b) => b.dong === dong);
    if (search) {
      list = list.filter(
        (b) =>
          b.dong &&
          b.dong.replace(/\s+/g, "").includes(search)
      );
    }

    currentList = list; // 현재 표시 목록 저장
    renderMarkers(list);
  }

  citySelect.addEventListener("change", () => {
    updateDongOptions();
    applyFilter();
  });

  dongSelect.addEventListener("change", applyFilter);

  if (dongSearchBtn && dongSearchInput) {
    dongSearchBtn.addEventListener("click", applyFilter);
    dongSearchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        applyFilter();
      }
    });
  }

  // 초기 상태: 전체
  updateDongOptions();
  applyFilter();
}

// 두 좌표 사이 거리(km) 계산 (해버사인 공식 간단 버전)
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // 지구 반지름(km)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// "내 위치에서 가장 가까운 제설함" 버튼 기능
function initNearestButton() {
  const btn = document.getElementById("nearestBtn");
  const hint = document.getElementById("hintNearest");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (hint) {
      hint.innerHTML =
        "내 위치를 확인하는 중입니다.<br/>" +
        "브라우저(또는 앱)의 위치 권한을 허용해 주세요.";
    }

    if (!map) {
      if (hint) {
        hint.innerHTML =
          "지도가 아직 준비되지 않았습니다.<br/>" +
          "페이지를 새로고침한 후 다시 이용해 주세요.";
      }
      return;
    }

    if (!navigator.geolocation) {
      if (hint) {
        hint.innerHTML =
          "이 브라우저에서는 위치 정보를 사용할 수 없습니다.<br/>" +
          "다른 브라우저 또는 기기에서 이용해 주세요.";
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLat = pos.coords.latitude;
        const myLng = pos.coords.longitude;

        // 현재 필터된 목록이 있으면 그 안에서, 아니면 전체에서 검색
        const targetList = currentList.length ? currentList : parsedBoxes;

        if (!targetList.length) {
          if (hint) {
            hint.innerHTML =
              "제설함 데이터가 없습니다.<br/>" +
              "시/군과 동(읍/면) 선택을 다시 확인해 주세요.";
          }
          return;
        }

        let nearest = null;
        let minDist = Infinity;

        targetList.forEach((b) => {
          if (b.lat == null || b.lng == null) return;
          const d = getDistanceKm(myLat, myLng, b.lat, b.lng);
          if (d < minDist) {
            minDist = d;
            nearest = b;
          }
        });

        if (!nearest) {
          if (hint) {
            hint.innerHTML =
              "근처 제설함을 찾지 못했습니다.<br/>" +
              "잠시 후 버튼을 한 번 더 눌러 주세요.";
          }
          return;
        }

        const posLatLng = new kakao.maps.LatLng(nearest.lat, nearest.lng);

        // 지도 이동 + 고정 확대 (레벨 5)
        map.panTo(posLatLng);
        map.setLevel(5);

        const infoHtml = `
          <div style="padding:6px 8px;font-size:12px;">
            <b>가장 가까운 제설함</b><br/>
            ${nearest.sigunNm} ${nearest.gu ? nearest.gu + " " : ""}${nearest.dong}<br/>
            ${nearest.addr}<br/>
            거리: 약 ${minDist.toFixed(2)} km<br/>
            ${nearest.manager ? `관리기관: ${nearest.manager}<br/>` : ""}
            <span style="display:block;margin-top:4px;color:#9ca3af;font-size:11px;">
              ※ GPS 수신 상태에 따라 한 번에 정확히 잡히지 않을 수 있습니다.<br/>
              위치가 다르게 보이면 잠시 후 버튼을 한 번 더 눌러 주세요.
            </span>
          </div>
        `;
        const infowindow = new kakao.maps.InfoWindow({
          position: posLatLng,
          content: infoHtml
        });
        infowindow.open(map);

        if (hint) {
          hint.innerHTML =
            "내 위치 기준으로 가장 가까운 제설함을 표시했습니다.<br/>" +
            "위치가 부정확해 보이면 잠시 후 버튼을 한 번 더 눌러 주세요.";
        }
      },
      (err) => {
        console.error(err);
        if (hint) {
          hint.innerHTML =
            "내 위치를 불러오지 못했습니다.<br/>" +
            "위치 권한을 허용했는지 확인하신 후,<br/>" +
            "잠시 후 버튼을 한 번 더 눌러 주세요.";
        }
      }
    );
  });
}

window.onload = function () {
  initData();
  initMap();
  initFilters();
  initNearestButton();
};
