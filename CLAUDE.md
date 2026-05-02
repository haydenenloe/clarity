# Clarity Web — Claude Code Config

## gstack
Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn

If gstack skills aren't working, run: cd .claude/skills/gstack && ./setup

## Standard deploy checklist (Pixel must follow)
1. Run /review on any branch before shipping
2. After deploy to getclarityapp.app, run /qa on https://getclarityapp.app
3. Flag any /review findings to Teddy before merging if severity is high

## Project context
- Stack: Next.js 14 App Router, TypeScript, Tailwind, Supabase, Vercel
- Live URL: https://getclarityapp.app
- Supabase project: gjgfnodlfgkuyihlofvh
- Deploy: vercel --prod --yes, then alias to getclarityapp.app
