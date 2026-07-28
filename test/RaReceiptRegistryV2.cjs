const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RaReceiptRegistryV2", function () {
  async function deployFixture() {
    const [owner, recorder, user] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("RaReceiptRegistryV2");
    const registry = await Registry.deploy(recorder.address);
    await registry.waitForDeployment();
    return { registry, owner, recorder, user };
  }

  it("supports swap action receipts", async function () {
    const { registry, recorder, user } = await deployFixture();
    const commandId = "0x1111111111111111111111111111111111111111111111111111111111111111";
    const swapTxHash = "0x2222222222222222222222222222222222222222222222222222222222222222";
    const metadataHash = "0x4444444444444444444444444444444444444444444444444444444444444444";

    await expect(
      registry.connect(recorder).recordReceipt(
        commandId,
        4,
        user.address,
        user.address,
        1_000_000,
        5042002,
        5042002,
        swapTxHash,
        swapTxHash,
        metadataHash,
      ),
    )
      .to.emit(registry, "ReceiptRecorded")
      .withArgs(
        commandId,
        4,
        user.address,
        user.address,
        1_000_000,
        5042002,
        5042002,
        swapTxHash,
        swapTxHash,
        metadataHash,
      );
  });

  it("rejects action types above swap", async function () {
    const { registry, recorder } = await deployFixture();

    await expect(
      registry.connect(recorder).recordReceipt(
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        5,
        recorder.address,
        recorder.address,
        1_000_000,
        5042002,
        5042002,
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x4444444444444444444444444444444444444444444444444444444444444444",
      ),
    ).to.be.revertedWithCustomError(registry, "InvalidActionType");
  });
});
