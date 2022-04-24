import React, { useState, useEffect } from 'react'
import { ethers, BigNumber } from 'ethers'
import constants from './configs/constants'
import tokenAbi from './abis/MockERC20.json'
import lotteryAbi from './abis/Lottery.json'
import './App.css';

function App() {
  const [signer, setSigner] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
	const [defaultAccount, setDefaultAccount] = useState(null);
	const [userBalance, setUserBalance] = useState(null);
	const [connButtonText, setConnButtonText] = useState('Connect Wallet');
	const [provider, setProvider] = useState(null);
	const [betNumber, setBetNumber] = useState('');
	const [betNumberOnChain, setBetNumberOnChain] = useState(null);
	const [isStop, setIsStop] = useState(false);
	const [reward, setReward] = useState(false);
	const [token, setToken] = useState(null);
	const [lottery, setLottery] = useState(null);

	const connectWalletHandler = async () => {
		if (window.ethereum && defaultAccount == null) {
			// set ethers provider
			let provider = new ethers.providers.Web3Provider(window.ethereum)
			await setProvider(provider);


			// set signer
			let signer = await provider.getSigner();
			await setSigner(signer);

			// connect to metamask
			await window.ethereum.request({ method: 'eth_requestAccounts'})
			.then(result => {
				setConnButtonText('Wallet Connected');
				setDefaultAccount(result[0]);
			})
			.catch(err => {
				setErrorMessage(err?.data?.message || err.message);
			});

      // set contracts
			setToken(new ethers.Contract(constants.contractAddress.mockErc20, tokenAbi.abi, provider));
			setLottery(new ethers.Contract(constants.contractAddress.lottery, lotteryAbi.abi, provider));
  
		} else if (!window.ethereum){
			console.log('Need to install MetaMask');
			setErrorMessage('Please install MetaMask browser extension to interact');
		}
	}

	const getAccountBalance = async () => {
		try {
			if (defaultAccount && token) {
				const balance = await token.balanceOf(defaultAccount);
				setUserBalance(ethers.utils.formatEther(balance));
			}
		} catch (err) {
			setErrorMessage(err?.data?.message || err.message);
		}
	};

	const changedHandler = () => {
		window.location.reload();
	}

	// listen for account changes
	window.ethereum.on('accountsChanged', changedHandler);
  window.ethereum.on('chainChanged', changedHandler);

  const onClaimToken = async () => {
    try {
      await token.connect(signer).claimMockToken();
    } catch (err) {
      setErrorMessage(err?.data?.message || err.message);
    }
  }

  const onChangeBetNumber = event => setBetNumber(event?.target?.value)

  const onBet = async (event) => {
    event.preventDefault();
    try {
      await lottery.connect(signer).bet(betNumber);
    } catch(err) {
      if (err?.data?.message === 'execution reverted: ERC20: insufficient allowance') {
        const totalSupply = await token.totalSupply();
        await token.connect(signer).approve(lottery.address, totalSupply);
      } else {
        setErrorMessage(err?.data?.message || err.message);
      }
    }
  }

  const onClaimReward = async () => {
    try {
      await lottery.connect(signer).claimReward()
    } catch (err) {
      setErrorMessage(err?.data?.message || err.message);
    }
  }

  const onStopGame = async () => {
    await lottery.connect(signer).stopGame()
  }

  const updateGameStatus = async () => {
    const status = await lottery.isStop();
    setIsStop(status)
  }

	useEffect(() => {
		if(defaultAccount && provider && token){
			getAccountBalance();
		};
	}, [defaultAccount, provider, token]);

  useEffect(() => {
    if (token && defaultAccount) {
      // token.on('Approval', async (owner) => {
      //   if (owner.toLowerCase() === defaultAccount.toLowerCase()) {
      //     await lottery.connect(signer).bet(betNumber);
      //   }
      // })

      token.on('ClaimToken', async (claimer) => {
        if (claimer.toLowerCase() === defaultAccount.toLowerCase()) {
          const balance = await token.balanceOf(defaultAccount);
				  setUserBalance(ethers.utils.formatEther(balance));
        }
      })
    }
  }, [token, defaultAccount])

  useEffect(() => {
    if (lottery && defaultAccount) {
      updateGameStatus()

      lottery.on('Bet', async (player, betNumber) => {
        if (player.toLowerCase() === defaultAccount.toLowerCase()) {
          setBetNumberOnChain(betNumber.toString());
        }
      })

      lottery.on('Stop', async (isStop) => {
        if (isStop) {
          setIsStop(true);
        }
      })

      lottery.on('ClaimReward', async (winner, reward) => {
        if (winner.toLowerCase() === defaultAccount.toLowerCase()) {
          setReward(reward.toString());
        }
      })
    }
  }, [lottery, defaultAccount, betNumber])

  const isDealer = defaultAccount?.toLowerCase() === constants.dealer.toLowerCase()

  return (
    <div className="App">
      <div className='container'>
        <h4> Connection to MetaMask </h4>
        <button onClick={connectWalletHandler}>{connButtonText}</button>
        <div className='accountDisplay'>
          <h3>Address: {defaultAccount}</h3>
        </div>

        {defaultAccount && <button onClick={onClaimToken}>{'Claim token to play'}</button>}

        <div className='balanceDisplay'>
          <h3>Balance: {userBalance}</h3>
        </div>

        {
          defaultAccount && !isDealer && (
            <>
              <h4> Bet amount: 100 </h4>
              <form onSubmit={onBet}>
                <label>
                  Bet number:
                  <input type="number" value={betNumber} onChange={onChangeBetNumber} />
                </label>
                <input type="submit" value="Bet" />
              </form>
              If this is your first time playing, you must have approved the token before you can bet.
            </>
          )
        }

        {
          isStop && !isDealer && (
            <button onClick={onClaimReward}>{'Claim reward'}</button>
          )
        }

        {
          isDealer && !isStop && <button onClick={onStopGame}>{'Stop the game'}</button>
        }

        {
          betNumberOnChain && (
            <div>
              <h3>You bet: {betNumberOnChain}</h3>
            </div>
          )
        }

        {
          isStop && (
            <div>
              <h3>Game stopped!</h3>
            </div>
          )
        }

        {
          reward && (
            <div>
              <h3>You claimed: {reward}</h3>
            </div>
          )
        }

        {errorMessage}
		  </div>
    </div>
  );
}

export default App;
