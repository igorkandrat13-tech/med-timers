# Med Timers — APK для Android‑планшета (TWA)

Нативный APK для Android проще всего сделать как **TWA (Trusted Web Activity)**: это “обёртка” над веб‑приложением, которое работает в полноэкранном режиме без адресной строки. Такой APK открывает ваш сайт (например, `https://med-timers.westa.by`) и использует вашу текущую авторизацию/сервер/WS.

> Если вам нужен APK для работы по HTTP (локальный IP без HTTPS), TWA не подойдёт. В этом случае используйте WebView/Capacitor (см. “Альтернатива” в конце).

---

## 1) Что нужно подготовить

- Домен приложения должен быть **по HTTPS** (для TWA это обязательно).
- На сервере должен быть доступен файл:
  - `/.well-known/assetlinks.json`

В репозитории уже добавлен файл-заглушка:
- `public/.well-known/assetlinks.json` (сейчас пустой `[]`, его нужно заполнить данными вашего ключа подписи).

---

## 2) Установка инструментов на Windows

1. Установите **Node.js LTS** (18+).
2. Установите **Java JDK** (17 рекомендовано).
3. Установите **Android Studio** (или Android Command Line Tools), чтобы были:
   - Android SDK
   - build-tools
   - platform-tools

Убедитесь, что команды доступны:
- `node -v`
- `java -version`
- `adb version`

---

## 3) Установка Bubblewrap (TWA)

В PowerShell:

```powershell
npm i -g @bubblewrap/cli
```

Проверка:

```powershell
bubblewrap --help
```

---

## 4) Инициализация Android‑проекта TWA

Выберите, что будет открываться в APK:
- Для “планшета врача”: `https://med-timers.westa.by/doctor/doctor.html`
- Для “главной страницы выбора роли”: `https://med-timers.westa.by/`

Обычно удобно делать отдельный APK “Планшет врача”, поэтому используем `doctor/doctor.html`.

Запустите:

```powershell
mkdir twa-doctor
cd twa-doctor

bubblewrap init --manifest=https://med-timers.westa.by/doctor/manifest.json
```

Bubblewrap задаст вопросы (packageId, appName, startUrl и др.). Рекомендуемые ответы:
- **Application name**: `Med Timers`
- **Short name**: `MedTimers`
- **Package name**: например `by.westa.medt.Doctor` (можно другое, но один раз и навсегда)
- **Start URL**: `/doctor/doctor.html`
- **Display mode**: `standalone`

Далее Bubblewrap предложит создать/использовать keystore (ключ подписи).

---

## 5) Настройка Digital Asset Links (assetlinks.json)

Чтобы TWA открывалась без предупреждений и адресной строки, Android должен “доверять” вашему домену. Для этого:

### 5.1 Получить SHA‑256 отпечаток сертификата подписи

Если keystore создан Bubblewrap, найдите путь к нему (он будет указан в конфиге проекта) и выполните:

```powershell
keytool -list -v -keystore path\to\keystore.jks
```

Скопируйте **SHA256** из вывода.

### 5.2 Заполнить `assetlinks.json`

Откройте файл:
- `d:\!Soft\med-timers\public\.well-known\assetlinks.json`

И вставьте такой JSON (замените package name и SHA256):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "by.westa.medt.Doctor",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:...:FF"
      ]
    }
  }
]
```

Проверьте, что URL доступен извне:
- `https://med-timers.westa.by/.well-known/assetlinks.json`

---

## 6) Сборка APK

В папке TWA‑проекта (например `twa-doctor`):

```powershell
bubblewrap build
```

Для релизной сборки:

```powershell
bubblewrap build --release
```

Файл `.apk` появится в каталоге сборки проекта (Bubblewrap покажет путь).

---

## 7) Установка APK на планшет

### Вариант A: через ADB (удобно для теста)

```powershell
adb devices
adb install path\to\app-release.apk
```

### Вариант B: вручную
- Скопируйте APK на планшет
- Разрешите “Установка из неизвестных источников”
- Откройте APK и установите

---

## Альтернатива (если нужен APK по HTTP/IP без HTTPS)

Если планшет должен открывать `http://192.168.x.x:3000` (без HTTPS), TWA работать корректно не будет.

Варианты:
- **PWA** (добавить на главный экран через Chrome) — чаще всего самый простой и надёжный путь.
- **Capacitor (WebView)** — можно собрать APK, который грузит HTTP URL (нужно разрешить cleartext traffic).

Если вам нужен именно “HTTP‑APK”, скажите — подготовлю Capacitor‑проект в репозитории (android‑папка + конфиги) и инструкцию сборки.

