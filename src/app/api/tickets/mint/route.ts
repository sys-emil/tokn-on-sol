import { NextRequest, NextResponse } from "next/server";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  createSignerFromKeypair,
  publicKey,
} from "@metaplex-foundation/umi";
import {
  mplBubblegum,
  mintV1,
  TokenProgramVersion,
  parseLeafFromMintV1Transaction,
} from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { getOperatorKeypair } from "@/lib/solana";
import { clusterApiUrl } from "@solana/web3.js";

const MERKLE_TREE = process.env.MERKLE_TREE_ADDRESS ?? "";

interface MintRequestBody {
  eventName: string;
  eventDate: string;
  ownerWallet: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: MintRequestBody;

  try {
    body = (await req.json()) as MintRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { eventName, eventDate, ownerWallet } = body;

  if (!eventName || !eventDate || !ownerWallet) {
    return NextResponse.json(
      { success: false, error: "eventName, eventDate, and ownerWallet are required" },
      { status: 400 }
    );
  }

  if (!MERKLE_TREE) {
    return NextResponse.json(
      { success: false, error: "MERKLE_TREE_ADDRESS is not configured" },
      { status: 500 }
    );
  }

  try {
    const operatorKeypair = getOperatorKeypair();

    const umi = createUmi(clusterApiUrl("devnet"))
      .use(mplBubblegum())
      .use(mplTokenMetadata());

    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(
      operatorKeypair.secretKey
    );
    const operatorSigner = createSignerFromKeypair(umi, umiKeypair);
    umi.use(keypairIdentity(umiKeypair));

    const builder = mintV1(umi, {
      leafOwner: publicKey(ownerWallet),
      merkleTree: publicKey(MERKLE_TREE),
      payer: operatorSigner,
      metadata: {
        name: eventName,
        symbol: "TOKN",
        uri: "",
        sellerFeeBasisPoints: 0,
        // collection: null until a collection mint is created
        collection: null,
        creators: [
          {
            address: operatorSigner.publicKey,
            verified: true,
            share: 100,
          },
        ],
        // attributes live in the off-chain JSON at `uri`; not part of on-chain MetadataArgs
        isMutable: true,
        primarySaleHappened: false,
        editionNonce: 0,
        uses: null,
        tokenProgramVersion: TokenProgramVersion.Original,
        tokenStandard: null,
      },
    });

    const { signature } = await builder.sendAndConfirm(umi, {
      confirm: { commitment: "confirmed" },
    });

    const signatureBase58 = Buffer.from(signature).toString("base64");

    let assetId = "";
    let parseError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
      try {
        const leaf = await parseLeafFromMintV1Transaction(umi, signature);
        assetId = leaf.id.toString();
        if (assetId) break;
      } catch (err) {
        parseError = err;
      }
    }

    if (!assetId) {
      const message = parseError instanceof Error ? parseError.message : "leaf parse failed";
      return NextResponse.json(
        { success: false, error: `Could not derive assetId from transaction: ${message}`, signature: signatureBase58 },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, assetId, signature: signatureBase58 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
