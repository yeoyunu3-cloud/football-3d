<div align="center">

# ⚽ 축구 3D

**브라우저에서 바로 즐기는 3D 축구 게임**
피파 모티브 키 배치로, 익숙한 손맛 그대로 플레이하세요.

[![지금 플레이](https://img.shields.io/badge/▶_지금_플레이-1f8f5f?style=for-the-badge)](https://yeoyunu3-cloud.github.io/football-3d/)
&nbsp;
![Three.js](https://img.shields.io/badge/Three.js-r170-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-ES_Modules-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)

<img src="docs/home.png" alt="축구 3D 홈 화면" width="860">

</div>

---

## ✨ 특징

| 기능 | 설명 |
|---|---|
| 🎮 **직접 플레이** | 선수를 직접 조작하는 8분 경기 |
| 📋 **감독 모드** | 전술을 지시하고 AI 경기를 관전 |
| ⌨️ **피파 모티브 조작** | 방향키 + S·W·A·D 중심의 키 배치 |
| 🛡️ **태클 & 슬라이딩** | 정면 태클은 깔끔하게, 뒤에서 들어가면 반칙 |
| 🏃 **침투 지시** | Q로 침투, 1~4로 침투 방향 지정 |
| 🥅 **세트피스 & 승부차기** | 코너킥·프리킥·페널티·승부차기 지원 |
| 🔊 **공 소리** | 드리블 터치·볼 컨트롤·킥 소리 (오디오 파일 없이 실시간 합성) |
| 👀 **잘 보이는 공** | 크고 밝은 공 + 바닥 표시 링 |

---

## 🎮 조작법

> 기본 조작은 **피파 모티브 · 방향키**입니다. 경기 준비 화면의 **조작 설정**에서 기존 WASD 방식으로 바꿀 수 있습니다.

### 🔵 기본

| 키 | 동작 |
|:---:|---|
| `방향키` | 이동 |
| `E` | 전력 질주 |
| `S` | 짧은 패스 |
| `W` | 스루패스 |
| `A` | 로빙 패스 · 크로스 |
| `D` | 슛 · 헤딩 |
| `Esc` | 경기 메뉴 |

### ⚔️ 공격

| 키 | 동작 |
|:---:|---|
| `A` `A` | 땅볼 크로스 |
| `Z` + `A` | 감아 올리는 크로스 |
| `Z` + `S` | 감아 차는 패스 |
| `D` `D` | 깔아차기 |
| `E` `E` / `Ctrl` | 치고 달리기 |
| `Q` | 침투 지시 |
| `1` `2` `3` `4` | 침투 방향 — 왼쪽 측면 · 왼쪽 안쪽 · 오른쪽 안쪽 · 오른쪽 측면 |

### 🎯 슛 종류

| 키 | 슛 |
|:---:|---|
| `D` | 일반 슛 |
| `Z` + `D` | 감아차기 |
| `C` + `D` | 라보나 슛 |
| `F` + `D` | 파워슛 |
| `Q` + `D` | 칩슛 |

### 🛡️ 수비

| 키 | 동작 |
|:---:|---|
| `Space` | 스탠딩 태클 |
| `A` | 슬라이딩 태클 |
| `S` / `Q` | 선수 변경 |

### 🧤 기타

| 키 | 동작 |
|:---:|---|
| `E` + `C` | 패스·슛 입력 취소 |
| `W` | 골키퍼 공 놓기 |
| `S` / `A` | 스로인 짧게 / 길게 |

> 💡 **팁** — `A`·`D`를 한 번만 누르면 두 번째 탭을 기다리느라 아주 짧게(0.17초) 늦게 찹니다.
> 💡 **팁** — 침투를 지시한 뒤 `W`를 누르면 그 선수에게 스루패스가 갑니다. 측면으로 넓게 빠진 선수는 방향키로 겨눠 주세요.

---

## 🚀 로컬에서 실행하기

빌드 과정 없이 정적 파일만으로 동작합니다. ES 모듈을 쓰기 때문에 `index.html`을 더블클릭하지 말고 간단한 서버로 열어 주세요.

```bash
git clone https://github.com/yeoyunu3-cloud/football-3d.git
cd football-3d
python3 -m http.server 8765
```

브라우저에서 <http://localhost:8765> 를 열면 됩니다.

---

## 🗂️ 구조

```
football-3d/
├── index.html            # 화면 구성
├── game.js               # 렌더링 · 입력 · UI
├── controls.js           # 키 배치 프리셋 (피파 모티브 / 기존 WASD)
├── match.js              # 경기 엔진 (패스 · 슛 · 태클 · 침투)
├── ball-flight.js        # 공 궤적 (감아차기 · 라보나 · 깔아차기)
├── ball-sound.js         # 공 소리 합성 (Web Audio)
├── real-player-model.js  # 선수 3D 모델 · 애니메이션
├── team-ai.js · attacking.js · keeper*.js   # AI
├── assets/players/       # 선수 모델 · 모션 · 얼굴 텍스처
└── vendor/               # Three.js r170
```

---

<div align="center">

**⚠️ 고지**
이 프로젝트는 축구 게임의 조작 방식에서 모티브를 얻은 개인 프로젝트입니다.
특정 상용 게임·게임사와 관련이 없으며, 공식 제품이 아닙니다.

</div>
