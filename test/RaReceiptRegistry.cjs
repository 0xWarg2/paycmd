const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZeroAddress } = require("ethers");

describe("RaReceiptRegistry", function () {
  async function deployFixture() {
    const [owner, recorder, unauthorized] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("RaReceiptRegistry");
    const registry = await Registry.deploy(recorder.address);
    await registry.waitForDeployment();
    return { registry, owner, recorder, unauthorized };
  }

  it("authorizes the deployer and initial recorder", async function () {
    const { registry, owner, recorder } = await deployFixture();

    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.recorders(owner.address)).to.equal(true);
    expect(await registry.recorders(recorder.address)).to.equal(true);
  });

  it("lets owner update recorder authorization", async function () {
    const { registry, recorder } = await deployFixture();

    await expect(registry.setRecorder(recorder.address, false))
      .to.emit(registry, "RecorderUpdated")
      .withArgs(recorder.address, false);

    expect(await registry.recorders(recorder.address)).to.equal(false);

    await expect(registry.setRecorder(recorder.address, true))
      .to.emit(registry, "RecorderUpdated")
      .withArgs(recorder.address, true);
  });

  it("rejects unauthorized receipt writers", async function () {
    const { registry, unauthorized } = await deployFixture();

    await expect(
      registry.connect(unauthorized).recordReceipt(
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        1,
        unauthorized.address,
        unauthorized.address,
        1_000_000,
        84532,
        5042002,
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333333333333333333333333333",
        "0x4444444444444444444444444444444444444444444444444444444444444444",
      ),
    ).to.be.revertedWithCustomError(registry, "NotRecorder");
  });

  it("rejects invalid action type", async function () {
    const { registry, recorder } = await deployFixture();

    await expect(
      registry.connect(recorder).recordReceipt(
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        0,
        recorder.address,
        recorder.address,
        1_000_000,
        84532,
        5042002,
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333333333333333333333333333",
        "0x4444444444444444444444444444444444444444444444444444444444444444",
      ),
    ).to.be.revertedWithCustomError(registry, "InvalidActionType");
  });

  it("emits ReceiptRecorded for authorized recorder", async function () {
    const { registry, owner, recorder } = await deployFixture();
    const commandId = "0x1111111111111111111111111111111111111111111111111111111111111111";
    const sourceTxHash = "0x2222222222222222222222222222222222222222222222222222222222222222";
    const destinationTxHash = "0x3333333333333333333333333333333333333333333333333333333333333333";
    const metadataHash = "0x4444444444444444444444444444444444444444444444444444444444444444";

    await expect(
      registry.connect(recorder).recordReceipt(
        commandId,
        1,
        owner.address,
        owner.address,
        5_000_000,
        84532,
        5042002,
        sourceTxHash,
        destinationTxHash,
        metadataHash,
      ),
    )
      .to.emit(registry, "ReceiptRecorded")
      .withArgs(
        commandId,
        1,
        owner.address,
        owner.address,
        5_000_000,
        84532,
        5042002,
        sourceTxHash,
        destinationTxHash,
        metadataHash,
      );
  });

  it("rejects zero owner transfer and zero recorder updates", async function () {
    const { registry } = await deployFixture();

    await expect(registry.transferOwnership(ZeroAddress)).to.be.revertedWithCustomError(
      registry,
      "ZeroAddress",
    );
    await expect(registry.setRecorder(ZeroAddress, true)).to.be.revertedWithCustomError(
      registry,
      "ZeroAddress",
    );
  });
});
