# uniearn

私有仓库 · 团队协作。占位 README：仓库尚无内容，先以此提交激活 `main` 分支，真实代码后续补充。

## 协作者快速开始

```sh
git clone https://github.com/dialling/uniearn.git
cd uniearn
git switch -c <你的分支名>      # 可选，也可直接提交到 main
# 改文件
git add -A
git commit -m "说明这次改了什么"
git push
```

首次推送如果被要求认证：用 GitHub 用户名 + Personal Access Token 当密码（或在装了 `gh` 的机器上先跑 `gh auth login`）。

## 当前权限

所有协作者已具备 **write** 权限：可以克隆、提交、直接 push 到 `main`、开分支、发 PR，也可以直接在 GitHub 网页上编辑文件并提交。`main` 未设保护分支。

## 约定

- 提交前先 `git pull --rebase`，避免把别人的改动顶掉。
- 改动大或影响他人时，走分支 + Pull Request，方便回退和 review。
