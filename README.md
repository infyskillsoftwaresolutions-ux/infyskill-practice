# InfySkill Practice

College practice for coding, SQL, web, aptitude, reasoning, and verbal. A student sees only their college’s published questions. Staff draft questions, and the main admin publishes them.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000/practice](http://localhost:3000/practice).

The sign-in page shows the local main admin when the default password is still in use. Set `PRACTICE_ADMIN_PASSWORD` before a public deploy. The database file is `crm.sqlite` in the local app data folder. Question logos are stored beside it and are not part of this repo.

A college can have its own address. On this machine that is `{slug}.localhost:3000`. On a live host it is `{slug}.infyskill.com` unless `PRACTICE_ROOT_HOST` is set.

Python grades coding answers on this machine. Java, C, and C++ grade when `javac`, `gcc`, and `g++` are installed. SQL runs in a fresh local database. Student code is not sent to a public judge.
