# TWA Doctor (APK)

Этот каталог содержит конфиг Bubblewrap для сборки APK “Планшет врача” (Trusted Web Activity) для домена `https://med-timers.westa.by`.

## Требования

- Windows
- Node.js (LTS)
- Java JDK 17
- Android SDK / Android Command Line Tools (можно через Android Studio)

## Сборка APK (рекомендовано через npx)

```powershell
cd d:\!Soft\med-timers

# 0) Один раз: создать ключ подписи (keystore) рядом с twa-manifest.json
#    (файл: twa-doctor\keystore.jks, alias: twa)
# keytool -genkeypair -v -keystore .\twa-doctor\keystore.jks -alias twa -keyalg RSA -keysize 2048 -validity 9125

# 1) Сгенерировать Android‑проект из twa-manifest.json
npx @bubblewrap/cli update --manifest .\twa-doctor

# 2) Собрать подписанный APK (пароли можно задать переменными окружения)
# setx BUBBLEWRAP_KEYSTORE_PASSWORD "ваш_пароль"
# setx BUBBLEWRAP_KEY_PASSWORD "ваш_пароль"
npx @bubblewrap/cli build --manifest .\twa-doctor --skipPwaValidation
```

Результат сборки:
- `twa-doctor/app-release-signed.apk` (для установки на планшет)

## Важно: assetlinks.json

На сервере должен быть доступен файл:
- `https://med-timers.westa.by/.well-known/assetlinks.json`

Он уже добавлен в репозиторий (папка `public/.well-known`).

После генерации keystore нужно убедиться, что `assetlinks.json` на сервере содержит:
- package_name: `by.westa.medt.Doctor`
- sha256_cert_fingerprints: SHA‑256 отпечаток сертификата из вашего keystore
