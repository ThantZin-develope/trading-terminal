import React, { createContext, JSX, useContext, useEffect, useId, useRef, useState, CSSProperties } from "react"
import { BrokerAPI, Account, Theme, Position, Order, OrderType } from "../apis/api"
import { AccountContext, AccountsContext, BrokerAPIContext, DefaultTheme, EuqityUpdateEvent, FlexBox, OrderUpdateEvent, PLUpdate, PositionUpdateEvent, ThemeContext, TradingHostAPIContext, TradingHostImpl } from "./TradingTerminal"
import styled from "styled-components";


export const DataTable = styled.table<{ bodyheight: number }>`
  tbody {
  display: block;
  overflow-y: scroll;
  height : ${props => props.bodyheight + 'px'}
  }

  thead, tbody tr {
  display: table;
  width: 100%;
  text-align: right;
  table-layout: fixed;
}
  tr{
    height: 25px;
  }
    tr:nth-child(even) {
  background-color: #D6EEEE;
} 
`;

interface AccountSelectionProps {
    theme?: Theme
    onAccSelected: (account: Account) => void
}


export const AccountSelection: React.FC<AccountSelectionProps> = (props) => {
    const accounts = useContext(AccountsContext)

    // TODO: theme
    const { theme = useContext(ThemeContext) } = props

    const onAccSelect = (accountId: string) => {
        const acc = accounts.find((e) => { return e.accountId === accountId })
        if (acc !== undefined) {
            props.onAccSelected(acc)
        }
    }


    return <select style={{ height: "100%", width: "100%" }} onChange={(e) => { onAccSelect(e.target.value) }}>
        <option value={""}>Please select account</option>
        {
            accounts.map((e, i) => {
                return <option value={e.accountId} key={i}>{e.accountId} : {e.name}</option>
            })
        }
    </select>
}

export interface AccountManagerProps {
    account?: Account,
    brokerAPI?: BrokerAPI,
    tradingHost?: TradingHostImpl,
    theme?: Theme
}
const AccountManager = ({
    props
}: {
    props: AccountManagerProps
}) => {

    const eventSubScriberId = useId()

    const tabs: { tabId: number, label: string }[] = [{ tabId: 1, label: "Positions" }, { tabId: 2, label: "Orders" }, { tabId: 3, label: "Summary" }, { tabId: 4, label: "Notifications" }]
    // TODO 
    const { account = useContext(AccountContext),
        brokerAPI = useContext(BrokerAPIContext),
        theme = useContext(ThemeContext) ?? DefaultTheme,
        tradingHost = useContext(TradingHostAPIContext)
    } = props

    const [selectedTab, setSelectedTab] = useState<number>(1)

    const [positions, setPositions] = useState<Position[]>([])

    const parentDiv = useRef<HTMLDivElement>(null)
    const resizeObserver = useRef<ResizeObserver>(null)

    const [parentDivSize, setParentDivSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
    const [orders, setOrders] = useState<Order[]>([])

    const [positionUpdate, setPositionUpdate] = useState<Position>()
    const [equityUpdate, setEquityUpdate] = useState<number>()
    const [orderUpdate, setOrderUpdate] = useState<Order>()
    const [plUpdate, setPLUpdate] = useState<{ positionId: string, pl: number }>()
    useEffect(() => {
        if (account && tradingHost) {
            //    brokerAPI.getOrders()
            tradingHost.subscribeEvent<Position>(eventSubScriberId, PositionUpdateEvent, (position: Position) => {

                setPositionUpdate(position)
            })

            tradingHost.subscribeEvent<number>(eventSubScriberId, EuqityUpdateEvent, (equity: number) => {
                setEquityUpdate(equity)
            })

            tradingHost.subscribeEvent<Order>(eventSubScriberId, OrderUpdateEvent, (order: Order) => {
                setOrderUpdate(order)
            })

            tradingHost.subscribeEvent<{ positionId: string, pl: number }>(eventSubScriberId, PLUpdate, (plUpdate: { positionId: string, pl: number }) => {
                setPLUpdate(plUpdate)
            })

        }
        return () => {
            if (tradingHost) {
                tradingHost.releaseEvent(eventSubScriberId, PositionUpdateEvent)
                tradingHost.releaseEvent(eventSubScriberId, EuqityUpdateEvent)
                tradingHost.releaseEvent(eventSubScriberId, OrderUpdateEvent)
                tradingHost.releaseEvent(eventSubScriberId, PLUpdate)
            }
        }
    }, [account])

    useEffect(() => {

        return () => {
            resizeObserver.current?.disconnect()
        }
    }, [])

    useEffect(() => {

        const fetchData = async () => {
            if (account && brokerAPI) {
                switch (selectedTab) {
                    case 1: {
                        const positions = await brokerAPI.getPositions(account.accountId).catch((err) => {
                            console.log("getPositions err ", err)
                            return []
                        })
                        if (positions.length > 0) {
                            setPositions([...positions])
                        }
                        break;
                    }
                    case 2: {
                        const orders = await brokerAPI.getOrders(account.accountId).catch((err) => {
                            console.log("getPositions err ", err)
                            return []
                        })
                        if (orders.length > 0) {
                            setOrders([...orders])
                        }
                        break;
                    }
                }
            }
        }

        fetchData()
        return () => {

        }
    }, [selectedTab, account])

    useEffect(() => {
        if (parentDiv.current) {
            setParentDivSize({ width: parentDiv.current.offsetWidth, height: parentDiv.current.offsetHeight })
            resizeObserver.current = new ResizeObserver(() => {
                if (parentDiv.current) {
                    if (parentDiv.current.offsetWidth !== parentDivSize.width) { // HERE
                        let newWidth = parentDiv.current.offsetWidth
                        setParentDivSize({ ...parentDivSize, width: newWidth })

                    }
                    if (parentDiv.current.offsetHeight !== parentDivSize.height) { // HERE
                        let newHeight = parentDiv.current.offsetHeight
                        setParentDivSize({ ...parentDivSize, height: newHeight })

                        // (chartContainerRef.current?.offsetWidth);
                    }
                }
            });
            resizeObserver.current.observe(parentDiv.current);
        }
    }, [parentDiv])


    useEffect(() => {

        console.log("Detected Sized ", parentDivSize)
    }, [parentDivSize])


    const onPositionCloseBtnClick = (positionId: string) => {
        if (!account || !brokerAPI) return

    }

    useEffect(() => {
        if (positionUpdate && selectedTab == 1) {
            setPositions((prev) => { return [...prev, positionUpdate] })
        }
    }, [positionUpdate])

    useEffect(() => { }, [equityUpdate])

    useEffect(() => {
        if (plUpdate && selectedTab == 1) {
            let index = positions.findIndex((e) => { return e.positionId === plUpdate.positionId })
            if (index !== -1) {
                let updatedPositions = positions.slice()
                updatedPositions[index].profit = plUpdate.pl
                setPositions([...updatedPositions])
            }
        }
    }, [plUpdate])

    useEffect(() => {
        if (orderUpdate && selectedTab == 2) {
            let index = orders.findIndex((e) => { return e.orderId === orderUpdate.orderId })
            if (index === -1) {
                setOrders((prev) => { return [...prev, orderUpdate] })
            } else {

                let updatedOrders = orders.slice()
                updatedOrders[index] = orderUpdate
                setOrders([...updatedOrders])
            }
        }
    }, [orderUpdate])
    // 
    const renderContent = (): JSX.Element => {
        if (account) {
            switch (selectedTab) {
                case 1: {
                    return parentDivSize.height < 70 ? <></> : <DataTable bodyheight={parentDivSize.height - 62} style={{ width: "100%" }}  >
                        <thead>
                            <tr>
                                <th>
                                    Account
                                </th>
                                <th>
                                    Symbol
                                </th>
                                <th>
                                    Side
                                </th>
                                <th>
                                    Qty
                                </th>
                                <th>
                                    Price
                                </th>
                                <th>
                                    Stop Loss
                                </th>
                                <th>
                                    Take Profit
                                </th>
                                <th>
                                    Profit
                                </th>
                            </tr>
                        </thead>
                        <tbody

                        >
                            {
                                positions.map((e, k) => {
                                    return <tr key={k} >
                                        <td >{account.accountId}</td>
                                        <td>{e.symbol}</td>
                                        <td>{e.side}</td>
                                        <td>{e.quantity}</td>
                                        <td>{e.price}</td>
                                        <td>{e.sl ?? ""}</td>
                                        <td>{e.tp ?? ""}</td>
                                        <td><FlexBox direction="row" style={{ justifyContent: "end" }}>
                                            <span>{e.profit ?? 0}</span> <span style={{ cursor: "pointer", marginLeft: "20px" }} onClick={() => { onPositionCloseBtnClick(e.positionId) }}>X</span>
                                        </FlexBox></td>
                                    </tr>
                                })
                            }
                        </tbody>
                    </DataTable>
                }
                case 2: {
                    return parentDivSize.height < 70 ? <></> :
                        <DataTable bodyheight={parentDivSize.height - 62} style={{ width: "100%" }}  >
                            <thead>
                                <tr>
                                    <th>
                                        Account
                                    </th>
                                    <th>
                                        Order
                                    </th>
                                    <th>
                                        Status
                                    </th>
                                    <th>
                                        Symbol
                                    </th>
                                    <th>
                                        Side
                                    </th>
                                    <th>
                                        Quantity
                                    </th>
                                    <th>
                                        Order Type
                                    </th>
                                    <th>
                                        Price
                                    </th>
                                    <th>
                                        Stop Loss
                                    </th>
                                    <th>
                                        Take Profit
                                    </th>
                                </tr>
                            </thead>
                            <tbody

                            >
                                {
                                    orders.map((e, k) => {
                                        return <tr key={k} >
                                            <td >{account.accountId}</td>
                                            <td>{e.orderId}</td>
                                            <td>{e.status}</td>
                                            <td>{e.symbol}</td>
                                            <td>{e.side}</td>
                                            <td>{e.quantity}</td>
                                            <td>{e.orderType}</td>
                                            <td>{e.orderType === OrderType.MARKET ? e.executedPrice : e.stopPrice}</td>
                                            <td>{e.sl ?? ""}</td>
                                            <td>{e.tp ?? ""}</td>
                                        </tr>
                                    })
                                }
                            </tbody>
                        </DataTable>
                }
                default: {
                    return <>Coming Soon....</>
                }
            }
        } else {
            return <div>Sign in account</div>
        }

    }

    return <div ref={parentDiv} style={{ height: "100%" }}>
        <FlexBox direction="row" style={{ height: "30px", cursor: "pointer" }}>
            {
                tabs.map((e) => {
                    return <div key={e.tabId} style={{ padding: "5px", border: "1px solid grey", color: selectedTab === e.tabId ? "blue" : "" }} onClick={() => {
                        setSelectedTab(e.tabId)
                    }}>{e.label}</div>
                })
            }
        </FlexBox>
        <div style={{ marginTop: "7px", height: "calc(100% - 30px)" }}>
            {
                renderContent()
            }

        </div>

    </div>
}

export default AccountManager

