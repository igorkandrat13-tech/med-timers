# Как настроить Git и обновление через GitHub

## 1. Установка Git на компьютер (Windows)
1. Скачайте Git для Windows: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Установите с настройками по умолчанию.
3. Откройте терминал (PowerShell или командную строку) и проверьте:
   ```powershell
   git --version
   ```

## 2. Настройка репозитория
1. Откройте папку проекта в терминале:
   ```powershell
   cd d:\!Soft\med-timers
   ```
2. Инициализируйте репозиторий:
   ```powershell
   git init
   git add .
   git commit -m "Первый запуск"
   ```

## 3. Загрузка на GitHub
1. Зарегистрируйтесь на [github.com](https://github.com) и создайте новый репозиторий (пустой).
2. Скопируйте ссылку на него (например, `https://github.com/ваш-логин/med-timers.git`).
3. Привяжите его к локальному проекту:
   ```powershell
   git remote add origin https://github.com/ваш-логин/med-timers.git
   git branch -M main
   git push -u origin main
   ```

## 4. Настройка сервера (Ubuntu)
Теперь сервер будет скачивать обновления прямо с GitHub.

1. Зайдите на сервер по SSH.
2. Запустите (или перезапустите) скрипт установки с указанием репозитория:
   ```bash
   sudo bash scripts/install-ubuntu.sh \
     --domain med-timers.westa.by \
     --user timer \
     --git-repo https://github.com/ваш-логин/med-timers.git
   ```
   *Скрипт сам скачает код, настроит права и перезапустит сервис.*

## 5. Как обновлять проект
1. **На компьютере**: Внесите изменения, сохраните.
2. Отправьте изменения на GitHub:
   ```powershell
   git add .
   git commit -m "Описание изменений"
   git push
   ```
3. **На сервере**: Зайдите и запустите команду обновления:
   ```bash
   sudo bash scripts/update-server.sh
   ```
   *Этот скрипт скачает последние изменения и перезапустит таймеры.*
