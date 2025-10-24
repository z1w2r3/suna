#!/usr/bin/env python3
"""Manual script to install Suna agent for a user."""
import asyncio
import sys
sys.path.insert(0, '/app')

from dotenv import load_dotenv
load_dotenv()

from core.utils.suna_default_agent_service import SunaDefaultAgentService
from core.services.supabase import DBConnection

async def main():
    account_id = "34d0a012-527d-4343-8fb6-bb1dc20c8f1a"

    print(f"Installing Suna agent for account: {account_id}")

    db = DBConnection()
    await db.initialize()

    service = SunaDefaultAgentService(db)
    agent_id = await service.install_suna_agent_for_user(account_id, replace_existing=False)

    if agent_id:
        print(f"✅ Successfully installed Suna agent: {agent_id}")
    else:
        print("❌ Failed to install Suna agent")

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
