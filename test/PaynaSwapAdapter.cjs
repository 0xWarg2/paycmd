const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZeroAddress } = require("ethers");

describe("PaynaSwapAdapter", function () {
  async function deployFixture() {
    const [owner, user, recipient, unauthorized] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const usdc = await Token.deploy("USD Coin", "USDC", 6);
    const eurc = await Token.deploy("Euro Coin", "EURC", 6);
    const cirbtc = await Token.deploy("Circle BTC", "cirBTC", 8);
    const unsupported = await Token.deploy("Other", "OTHER", 18);
    await Promise.all([usdc.waitForDeployment(), eurc.waitForDeployment(), cirbtc.waitForDeployment(), unsupported.waitForDeployment()]);

    const Factory = await ethers.getContractFactory("MockDexFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    const Pair = await ethers.getContractFactory("MockDexPair");
    const usdcEurcPair = await Pair.deploy(await usdc.getAddress(), await eurc.getAddress(), 1_000_000, 1_000_000);
    const usdcCirbtcPair = await Pair.deploy(await usdc.getAddress(), await cirbtc.getAddress(), 1_000_000, 100_000);
    await Promise.all([usdcEurcPair.waitForDeployment(), usdcCirbtcPair.waitForDeployment()]);

    await factory.setPair(await usdc.getAddress(), await eurc.getAddress(), await usdcEurcPair.getAddress());
    await factory.setPair(await usdc.getAddress(), await cirbtc.getAddress(), await usdcCirbtcPair.getAddress());

    const Router = await ethers.getContractFactory("MockDexRouter");
    const router = await Router.deploy(await factory.getAddress());
    await router.waitForDeployment();

    const Adapter = await ethers.getContractFactory("PaynaSwapAdapter");
    const adapter = await Adapter.deploy(
      await router.getAddress(),
      await factory.getAddress(),
      await usdc.getAddress(),
      await eurc.getAddress(),
      await cirbtc.getAddress(),
      owner.address,
    );
    await adapter.waitForDeployment();

    await usdc.mint(user.address, 10_000_000);
    await eurc.mint(user.address, 10_000_000);

    return {
      owner,
      user,
      recipient,
      unauthorized,
      usdc,
      eurc,
      cirbtc,
      unsupported,
      factory,
      router,
      usdcEurcPair,
      usdcCirbtcPair,
      adapter,
    };
  }

  it("swaps a direct USDC/EURC route", async function () {
    const { user, recipient, usdc, eurc, router, adapter } = await deployFixture();
    const amountIn = 1_000_000;
    const amountOutMin = 1_900_000;
    const deadline = Math.floor(Date.now() / 1000) + 600;

    await usdc.connect(user).approve(await adapter.getAddress(), amountIn);

    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await usdc.getAddress(),
        await eurc.getAddress(),
        amountIn,
        amountOutMin,
        recipient.address,
        deadline,
      ),
    )
      .to.emit(adapter, "PaynaSwapExecuted")
      .withArgs(
        user.address,
        await usdc.getAddress(),
        await eurc.getAddress(),
        amountIn,
        2_000_000,
        recipient.address,
        await router.getAddress(),
      );

    expect(await eurc.balanceOf(recipient.address)).to.equal(2_000_000);
  });

  it("swaps a EURC/cirBTC route through USDC", async function () {
    const { user, recipient, eurc, cirbtc, adapter } = await deployFixture();
    const amountIn = 1_000_000;
    const deadline = Math.floor(Date.now() / 1000) + 600;

    await eurc.connect(user).approve(await adapter.getAddress(), amountIn);

    await adapter.connect(user).swapExactTokensForTokens(
      await eurc.getAddress(),
      await cirbtc.getAddress(),
      amountIn,
      3_900_000,
      recipient.address,
      deadline,
    );

    expect(await cirbtc.balanceOf(recipient.address)).to.equal(4_000_000);
  });

  it("rejects unsupported tokens and same-token swaps", async function () {
    const { user, usdc, unsupported, adapter } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 600;

    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await unsupported.getAddress(),
        await usdc.getAddress(),
        1,
        1,
        user.address,
        deadline,
      ),
    ).to.be.revertedWithCustomError(adapter, "InvalidToken");

    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await usdc.getAddress(),
        await usdc.getAddress(),
        1,
        1,
        user.address,
        deadline,
      ),
    ).to.be.revertedWithCustomError(adapter, "SameToken");
  });

  it("rejects missing pairs, empty liquidity, zero amount, zero recipient, and expired deadlines", async function () {
    const { user, usdc, eurc, cirbtc, usdcEurcPair, factory, adapter } = await deployFixture();
    const now = Math.floor(Date.now() / 1000);

    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await usdc.getAddress(),
        await eurc.getAddress(),
        0,
        1,
        user.address,
        now + 600,
      ),
    ).to.be.revertedWithCustomError(adapter, "InvalidAmount");

    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await usdc.getAddress(),
        await eurc.getAddress(),
        1,
        1,
        ZeroAddress,
        now + 600,
      ),
    ).to.be.revertedWithCustomError(adapter, "ZeroAddress");

    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await usdc.getAddress(),
        await eurc.getAddress(),
        1,
        1,
        user.address,
        now - 1,
      ),
    ).to.be.revertedWithCustomError(adapter, "ExpiredDeadline");

    await factory.setPair(await usdc.getAddress(), await cirbtc.getAddress(), ZeroAddress);
    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await cirbtc.getAddress(),
        await eurc.getAddress(),
        1,
        1,
        user.address,
        now + 600,
      ),
    ).to.be.revertedWithCustomError(adapter, "PairNotFound");

    await usdcEurcPair.setReserves(0, 1);
    await expect(
      adapter.connect(user).swapExactTokensForTokens(
        await usdc.getAddress(),
        await eurc.getAddress(),
        1,
        1,
        user.address,
        now + 600,
      ),
    ).to.be.revertedWithCustomError(adapter, "EmptyLiquidity");
  });

  it("restricts owner-only updates", async function () {
    const { owner, unauthorized, router, factory, adapter } = await deployFixture();

    await expect(adapter.connect(unauthorized).setDexRouter(await router.getAddress()))
      .to.be.revertedWithCustomError(adapter, "NotOwner");

    await expect(adapter.connect(owner).setDexRouter(ZeroAddress))
      .to.be.revertedWithCustomError(adapter, "ZeroAddress");

    await expect(adapter.connect(owner).setDexRouter(await router.getAddress()))
      .to.emit(adapter, "DexRouterUpdated");

    await expect(adapter.connect(owner).setDexFactory(await factory.getAddress()))
      .to.emit(adapter, "DexFactoryUpdated");
  });
});
