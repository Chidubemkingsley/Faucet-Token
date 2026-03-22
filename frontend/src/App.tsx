import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Alert,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { ethers, BigNumber } from "ethers";
import { useWeb3 } from "./hooks/useWeb3";
import { useToken } from "./hooks/useToken";
import { useCooldown } from "./hooks/useCooldown";

const App: React.FC = () => {
  const { provider, signer, account, connectWallet } = useWeb3();
  const token = useToken(signer);

  const [balance, setBalance] = useState("0");
  const [cooldown, setCooldown] = useState<BigNumber>(BigNumber.from(0));
  const [alert, setAlert] = useState("");

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  // Fetch balance and cooldown
  useEffect(() => {
    if (!account) return;

    const fetchData = async () => {
      try {
        const bal: BigNumber = await token.balanceOf(account);
        setBalance(ethers.utils.formatUnits(bal, 18));

        const rem: BigNumber = await token.getRemainingCooldown(account);
        setCooldown(rem);
      } catch (e) {
        console.error(e);
      }
    };

    fetchData();
  }, [account, token]);

  const { formatted: cooldownFormatted } = useCooldown(cooldown);

  // Request tokens
  const handleRequest = async () => {
    if (!account) return;
    try {
      await token.requestTokens();
      setAlert("Tokens requested successfully!");
      const rem: BigNumber = await token.getRemainingCooldown(account);
      setCooldown(rem);
    } catch (e: any) {
      setAlert(e?.reason || "Failed to request tokens");
    }
  };

  // Mint tokens (owner only)
  const handleMint = async () => {
    if (!account || !amount) return;
    try {
      const parsedAmount = ethers.utils.parseUnits(amount, 18);
      await token.mint(account, parsedAmount);
      setAlert("Minted successfully!");
    } catch (e: any) {
      setAlert(e?.reason || "Mint failed");
    }
  };

  // Transfer tokens
  const handleTransfer = async () => {
    if (!account || !recipient || !amount) return;
    try {
      const parsedAmount = ethers.utils.parseUnits(amount, 18);
      await token.transfer(recipient, parsedAmount);
      setAlert("Transfer successful!");
    } catch (e: any) {
      setAlert(e?.reason || "Transfer failed");
    }
  };

  return (
    <Box p={10}>
      <VStack gap={6} align="stretch">
        <Heading textAlign="center">WEB3CXIV Token Dashboard</Heading>

        {!account && <Button onClick={connectWallet}>Connect Wallet</Button>}

        {account && (
          <>
            <Text>
              <b>Account:</b> {account}
            </Text>
            <Text>
              <b>Balance:</b> {balance} CXIV
            </Text>

            {/* Faucet */}
            {cooldown.gt(0) ? (
              <Text fontSize="sm" color="gray.600">
                Faucet cooldown: {cooldownFormatted}
              </Text>
            ) : (
              <Button colorScheme="teal" onClick={handleRequest}>
                Request Tokens
              </Button>
            )}

            {/* Transfer */}
            <HStack gap={2}>
              <Input
                placeholder="Recipient Address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <Input
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button colorScheme="blue" onClick={handleTransfer}>
                Transfer
              </Button>
            </HStack>

            {/* Mint */}
            <HStack gap={2}>
              <Input
                placeholder="Mint Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button colorScheme="purple" onClick={handleMint}>
                Mint
              </Button>
            </HStack>

            {/* Alerts */}
            {alert && (
              <Alert status="info" borderRadius="md">
                <AlertTitle>Info</AlertTitle>
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
};

export default App;