'use client'
import React, { forwardRef, memo, useCallback, useContext, useEffect, useId, useRef, useState, createContext } from "react"
// import chartStyle from "./Chart.module.css"
import { v4 as uuidv4 } from 'uuid';
import { CandlestickSeries, createChart, CreatePriceLineOptions, CrosshairMode, IChartApi, IPriceLine, ISeriesApi, LineSeries, MouseEventParams, OhlcData, SeriesType, Time } from "lightweight-charts";
import { ColorType } from "lightweight-charts";
import { Account, BrokerAPI, DataFeedAPI, Order, OrderStatus, OrderType, Position, Resolution, Side, SymbolInfo, SystemManagerProps, Theme } from "../apis/api";
import styled, { ThemeProvider } from "styled-components";
import { createPortal } from "react-dom";
import AccountManager, { AccountManagerProps } from "./AccountManager";
// import { AccountContext } from "./AccountManager";




export const DefaultTheme: Theme = {
    textColor: "",
    buttonTheme: {
        backgroundColor: "",
        textColor: ""
    },
    background: ""
}



export type DynamicElement = { display: "none" | "block", pointerX: number, pointerY: number }

export type PendingOrderTradeType = "LIMIT" | "STOP"
export type PendingOrderTradingContext = { buy: PendingOrderTradeType, sell: PendingOrderTradeType, price: number }
// Middleware API that dispatch receving data update from broker api to chart.
export interface TradingHostAPI {
    // when order is updated.
    orderUpdate: (order: Order) => void;
    // when account is updated.
    accountUpdate: () => void;


    // Position Update 
    positionUpdate: (position: Position) => void;

    // equity update
    equityUpdate: (equity: number) => void;

    plUpdate: (positionId: string, pl: number) => void;

}

export const AccountUpdateEvent = "Acc"
export const OrderUpdateEvent = "Order"
export const PositionUpdateEvent = "Position"
export const EuqityUpdateEvent = "Equity"
export const PLUpdate = "PL"


export class TradingHostImpl implements TradingHostAPI {

    private events: Map<string, Array<(data: any) => void>> = new Map()

    subScribers: string[] = []
    constructor() {

    }
    positionUpdate(position: Position) {
        this.emitEvent<Position>(PositionUpdateEvent, position)

    }
    equityUpdate(equity: number) {
        this.emitEvent<number>(EuqityUpdateEvent, equity)
    }
    plUpdate(positionId: string, pl: number) {
        this.emitEvent<{ positionId: string, pl: number }>(PLUpdate, { positionId: positionId, pl: pl })
    }

    subscribeEvent<T>(subscriberId: string, event: string, callback: (data: T) => void) {

        if (!this.subScribers.find((e) => { return e === subscriberId })) {
            this.subScribers.push(subscriberId)
        }
        let eventName = `${subscriberId}-${event}`
        let oldEvents = this.events.get(eventName)
        let totalEvents: Array<(data: any) => void> = []
        if (oldEvents && oldEvents.length > 0) {
            totalEvents.push(...oldEvents)
        }
        totalEvents.push(callback)
        this.events.set(eventName, totalEvents)

    }
    orderUpdate(order: Order): void {
        this.emitEvent<Order>(OrderUpdateEvent, order)
    }
    accountUpdate(): void {

        this.emitEvent<void>(AccountUpdateEvent)
    }


    private emitEvent<T>(event: string, data?: T) {

        this.subScribers.forEach((e) => {
            let events = this.events.get(`${e}-${event}`)
            if (events) {
                events.forEach((callback) => {
                    callback(data)

                })
            }
        })


    }

    releaseEvent(subScriberId: string, event: string) {
        this.events.set(`${subScriberId}-${event}`, [])
    }


}

const RESOLUTIONS: Resolution[] = [
    { range: "1D", interval: "1m" },
    { range: "5D", interval: "5m" },
    { range: "1M", interval: "30m" },
    { range: "3M", interval: "1h" },
    { range: "6M", interval: "2h" },
]

// Calcualte Appropirat X and Y position for a dialog 
const calculateAppropirateXY = (width: number, height: number, pointerX: number, pointerY: number, maxY: number, minX: number): { x: number, y: number } => {
    let X, Y = 0

    if ((pointerX - width) < minX) {

        // Show Left
        X = pointerX
    } else {
        // Show Right
        X = (pointerX - width)
    }

    if ((maxY - pointerY) < height) {
        // Show Above
        Y = (pointerY - height)
    } else {
        // Show Below
        Y = pointerY
    }

    return { x: X, y: Y }
}




const DialogContextBtn = styled.div<{ theme?: string }>({
    cursor: "pointer",
    "&:hover": {
        background: "grey"
    }
})


const DEFAULT_RESOLUTION: Resolution = { range: "1D", interval: "1m" }


export const ThemeContext = createContext<Theme | undefined>(undefined)
export const DataFeedAPIContext = createContext<DataFeedAPI | undefined>(undefined)
export const BrokerAPIContext = createContext<BrokerAPI | undefined>(undefined)
export const TradingHostAPIContext = createContext<TradingHostImpl | undefined>(undefined)
export const SymbolsContext = createContext<SymbolInfo[]>([])
export const AccountsContext = createContext<Account[]>([])
export const AccountContext = createContext<Account | undefined>(undefined)
export const SelectedSymbolContext = createContext<SymbolInfo | undefined>(undefined)

const SystemManager = ({
    children, props
}: {
    children: React.ReactNode,
    props: SystemManagerProps
}) => {

    const eventSubScriberId = useId()
    const [symbols, setSymbols] = useState<SymbolInfo[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [currentAcc, setCurrentAcc] = useState<Account>()
    // const [selectedSymbol, setSelectedSymbol] = useState<SymbolInfo>()


    useEffect(() => {
        const subscribeEvents = async () => {
            const symbols = await props.dataFeedAPI.getSymbolsList().catch((err) => {
                console.log("getSymbolsList err ", err)
                return []
            })
            if (symbols && symbols.length > 0) {
                setSymbols([...symbols])
            }

            // props.tradingHost.subscribeEvent<string>(SymbolUpdateEvent, async (symbolId: string) => {
            //     const currentSymbol = await props.dataFeedAPI.getSymbolInfo(symbolId).catch((err) => {
            //         console.log("getSymbolInfo err ", currentSymbol)
            //         return null
            //     })
            //     if (currentSymbol !== null) {
            //         setSelectedSymbol(currentSymbol)
            //     }
            // })


            props.tradingHost.subscribeEvent<void>(eventSubScriberId, AccountUpdateEvent, async () => {

                const accounts = await props.brokerAPI.getAccountsInfo().catch((err) => {
                    console.log("getAccountsInfo err ", err)
                    return []
                })
                if (accounts && accounts.length > 0) {
                    setAccounts([...accounts])
                }
                const currentAccount = await props.brokerAPI.getCurrentAccount().catch((err) => {

                    console.log("getCurrentAccount err ", err)
                    return null
                })
                if (currentAccount !== null) {
                    setCurrentAcc(currentAccount)
                }

            })

        }
        subscribeEvents()
        return () => {
            // TODO : unscribe events
            props.tradingHost.releaseEvent(eventSubScriberId, AccountUpdateEvent)
        }
    }
        , [])

    return <ThemeContext.Provider value={props.theme ?? DefaultTheme}>
        <DataFeedAPIContext.Provider value={props.dataFeedAPI}>
            <BrokerAPIContext.Provider value={props.brokerAPI}>
                <TradingHostAPIContext.Provider value={props.tradingHost}>
                    <SymbolsContext.Provider value={symbols}>
                        {/* <SelectedSymbolContext.Provider value={selectedSymbol}> */}
                        <AccountsContext.Provider value={accounts}>
                            <AccountContext.Provider value={currentAcc}>
                                {children}
                            </AccountContext.Provider>
                        </AccountsContext.Provider>

                        {/* </SelectedSymbolContext.Provider> */}
                    </SymbolsContext.Provider>
                </TradingHostAPIContext.Provider>
            </BrokerAPIContext.Provider>
        </DataFeedAPIContext.Provider>

    </ThemeContext.Provider>
}

export const BidAskContext = createContext<BidAsk | undefined>(undefined)
export const OHLCContext = createContext<OLHC | undefined>(undefined)
// TerminalProps
export interface ChartProps {
    chartType: SeriesType,
    theme?: Theme,
    dataFeedAPI?: DataFeedAPI,
    brokerAPI?: BrokerAPI,
    tradingHost?: TradingHostImpl,
    symbol?: SymbolInfo,
    account?: Account

}
export const Chart = ({
    props
}: {
    props: ChartProps
}) => {


    // TODO : Theme
    const {
        theme = useContext(ThemeContext) ?? DefaultTheme,
        dataFeedAPI = useContext(DataFeedAPIContext),
        brokerAPI = useContext(BrokerAPIContext),
        symbol = useContext(SelectedSymbolContext),
        account = useContext(AccountContext),
        tradingHost = useContext(TradingHostAPIContext),
    } = props

    const eventSubScriberId = useId()

    const lotSizRef = useRef<HTMLInputElement>(null)


    const chartTradingDialogId = useId()
    const chartMainDialogId = useId()
    const chartOrderCreationDialogId = useId()

    // TODO: To configure with given theme
    const chartOptions = { layout: { textColor: 'black', background: { type: ColorType.Solid, color: 'white' } } };

    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi>(null)
    const chartSeriesRef = useRef<ISeriesApi<SeriesType>>(null)
    const openingOrderLines = useRef<{ priceLineId: IPriceLine, priceLine: CreatePriceLineOptions }[]>([])

    const chartSize = useRef<{ width: number, height: number }>({ width: 0, height: 0 })
    // const [chartSize, setChartSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 })
    const [spread, setSpread] = useState<BidAsk>({ bid: 0, ask: 0 })
    const [olhc, setOLHC] = useState<{ open: number, close: number, low: number, high: number }>({ open: 0, close: 0, low: 0, high: 0 })

    const [crossHairState, setCrossHairState] = useState<{ x: number | undefined, y: number | undefined }>({ x: undefined, y: undefined })
    const [mouseEventState, setMouseEventState] = useState<{ x: number, y: number, clicked: "Right" | "Left" }>()
    // Chart Trading Dialog store and state handler
    const [chartTradingDialogState, setChartTradingDialogState] = useState<DynamicElement & PendingOrderTradingContext>({
        display: "none",
        buy: "LIMIT",
        sell: "LIMIT",
        price: 0,
        pointerX: 0,
        pointerY: 0,

    })

    const [chartTradingActionState, setChartTradingActionState] = useState<{ price: number, position: { x: number, y: number } } & Omit<DynamicElement, "pointerX" | "pointerY">>({
        display: "none",
        price: 0,
        position: { x: 0, y: 0 },
    })


    const [chartMainDialogState, setChartMainDialogState] = useState<DynamicElement & PendingOrderTradingContext>({
        display: "none",
        buy: "LIMIT",
        sell: "LIMIT",
        price: 0,

        pointerX: 0,
        pointerY: 0
    })


    // Order creation dialog
    const [orderCreationDialogState, setOrderCreationDialogState] = useState<DynamicElement>({ pointerX: 0, pointerY: 0, display: "none" })


    const resizeObserver = useRef<ResizeObserver>(null)



    useEffect(() => {


        const initialize = async () => {
            if (chartContainerRef.current) {

                const chart = createChart(chartContainerRef.current, chartOptions);
                chartRef.current = chart

                // TODO : to style with provide theme

                switch (props.chartType) {
                    case "Candlestick": {
                        const candlestickSeries = chart.addSeries(CandlestickSeries, {
                            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
                            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
                        });

                        chartSeriesRef.current = candlestickSeries
                        break;
                    }
                    case "Line": {
                        const lineSeries = chart.addSeries(LineSeries);


                        chartSeriesRef.current = lineSeries
                        break;
                    }
                    default: {
                        const candlestickSeries = chart.addSeries(CandlestickSeries, {
                            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
                            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
                        });

                        chartSeriesRef.current = candlestickSeries
                    }
                }

                chart.applyOptions({ crosshair: { mode: CrosshairMode.Hidden } })


                chartRef.current.subscribeCrosshairMove((param) => {
                    setCrossHairState({ x: param.point?.x, y: param.point?.y })

                });

                chartRef.current.subscribeClick((param) => {
                    if (param.point) {
                        setMouseEventState({ x: param.point.x, y: param.point.y, clicked: "Left" })
                    }

                })


                // Resize handler 
                resizeObserver.current = new ResizeObserver(() => {
                    if (chartContainerRef.current?.offsetWidth !== chartSize.current.width) { // HERE
                        chartSize.current.width = chartContainerRef.current?.offsetWidth ?? 0
                        chartRef.current?.applyOptions({ width: chartSize.current.width });
                        // (chartContainerRef.current?.offsetWidth);
                    }
                    if (chartContainerRef.current?.offsetHeight !== chartSize.current.height) { //HERE
                        chartSize.current.height = chartContainerRef.current?.offsetHeight ?? 0
                        chartRef.current?.applyOptions({ height: chartSize.current.height });
                    }
                });
                resizeObserver.current.observe(chartContainerRef.current);

                // window.addEventListener('resize', handleResize);
            }
        }


        initialize()
        return () => {
            if (chartRef.current) chartRef.current.remove()
        }
    }
        , [])





    // useEffect(() => {
    // }, [chartSize])

    const disappearChartDialogs = (ids: string[]) => {


        for (let id of ids) {
            switch (id) {
                case (chartMainDialogId): {
                    setChartMainDialogState((prev) => { return { ...prev, display: "none" } })
                    break
                }
                case (chartTradingDialogId): {
                    setChartTradingDialogState((prev) => { return { ...prev, display: "none" } })
                    break
                }
                case (chartOrderCreationDialogId): {
                    setOrderCreationDialogState((prev) => { return { ...prev, display: "none" } })
                    break
                }
            }

        }


    }

    const onChartRightClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.preventDefault()
        setMouseEventState({ x: crossHairState.x as number, y: crossHairState.y as number, clicked: "Right" })

    }

    useEffect(() => {
        console.log("Mouse Clicked ", mouseEventState?.clicked)

        if (mouseEventState && chartRef.current && chartSeriesRef.current) {
            let chartHeight = chartRef.current.paneSize().height
            if (mouseEventState.clicked === "Right") {

                const price = chartSeriesRef.current.coordinateToPrice(mouseEventState.y ?? 0);
                if (price) {
                    setChartMainDialogState({
                        ...chartMainDialogState,
                        display: "block",
                        // position: { x: x, y: y },
                        buy: Number(price.toFixed(2)) > spread.bid ? "STOP" : "LIMIT",
                        sell: Number(price.toFixed(2)) > spread.bid ? "LIMIT" : "STOP",
                        price: Number(price.toFixed(2)),
                        pointerX: mouseEventState.x ?? 0,
                        pointerY: mouseEventState.y ?? 0
                    })
                }

                disappearChartDialogs([chartTradingDialogId, chartOrderCreationDialogId])

            } else {
                disappearChartDialogs([chartMainDialogId, chartOrderCreationDialogId])

                if (mouseEventState.x > chartTradingActionState.position.x) {

                    const price = chartSeriesRef.current?.coordinateToPrice(mouseEventState.y ?? 0);
                    if (price) {

                        setChartTradingDialogState({

                            display: "block",
                            pointerX: mouseEventState.x, pointerY: mouseEventState.y,

                            buy: Number(price.toFixed(2)) > spread.bid ? "STOP" : "LIMIT",
                            sell: Number(price.toFixed(2)) > spread.bid ? "LIMIT" : "STOP",
                            price: Number(price.toFixed(2)),
                        }
                        )
                    }

                } else {
                    disappearChartDialogs([chartTradingDialogId])
                }
            }
        }
    }, [mouseEventState])

    useEffect(() => {
        if (crossHairState && crossHairState.y !== undefined && chartRef.current) {

            const price = chartSeriesRef.current?.coordinateToPrice(crossHairState.y);

            if (price) {
                setChartTradingActionState({ display: "block", position: { x: chartRef.current.paneSize().width - 20, y: crossHairState.y - 13 }, price: Number(price.toFixed(2)), })
            }

        } else {
            setChartTradingActionState((prev) => { return { ...prev, display: "none" } })
        }
    }, [crossHairState.y])

    useEffect(() => {
        let barsSubScriptionId = ""
        let quoteSubScriptionId = ""
        const fetchData = async () => {
            if (symbol && chartRef.current && chartSeriesRef.current && dataFeedAPI) {


                const bars = await dataFeedAPI.getBars(symbol.symbolId, DEFAULT_RESOLUTION, props.chartType).catch((err) => {
                    console.log("getBars err ", err)
                    return []
                })
                if (bars && bars.length > 0) {
                    chartSeriesRef.current.setData(bars)
                    chartRef.current.timeScale().fitContent();
                }

                barsSubScriptionId = uuidv4()

                await dataFeedAPI.subscribeBars(symbol.symbolId, props.chartType, (data) => {
                    chartSeriesRef.current?.update(data)
                }, barsSubScriptionId).catch((err) => {
                    console.log("Error occrued at subscribeBars => ", err)
                })

                quoteSubScriptionId = uuidv4()
                await dataFeedAPI.subScribeQutoe(symbol.symbolId, (data) => {
                    setSpread(data.bidAsk)
                    setOLHC(data.olhc)
                }, quoteSubScriptionId).catch((err) => {
                    console.log("Error occrued at subScribeQutoe => ", err)
                })

            }
        }
        fetchData()

        return () => {
            if (barsSubScriptionId) {
                dataFeedAPI?.unSubscribeBars(barsSubScriptionId).catch((err) => {
                    console.log("Error occrued at unSubscribeBars => ", err)
                })
                console.log("Unsubscribed bars for symbolId ", symbol?.symbolId)
            }
            if (quoteSubScriptionId) {
                dataFeedAPI?.unSubscribeQuote(quoteSubScriptionId).catch((err) => {
                    console.log("Error occured at unSubscribeQuote => ", err)
                })
                console.log("Unsubscribed Quote for symbolId ", symbol?.symbolId)
            }
            chartSeriesRef.current?.setData([])
        }
    }, [symbol])



    useEffect(() => {

        const fetchData = async () => {
            if (account && chartRef.current && chartSeriesRef.current && brokerAPI && tradingHost) {
                const orders = await brokerAPI.getOrders(account.accountId).catch(err => {
                    console.log(" getOrders err => ", err)
                    return []
                })
                if (orders) {
                    // Add Price Lines

                    const newOpeningOrderLines: CreatePriceLineOptions[] = orders.filter((order) => { return order.status !== OrderStatus.CLOSED }).map((order) => {
                        return {
                            id: order.orderId,
                            price: order.executedPrice ?? 0,
                            title: `${order.orderId} ${order.side} ${order.quantity}`,
                            color: "green",
                            lineWidth: 2,
                            lineStyle: 2, // LineStyle.Dashed
                            axisLabelVisible: true,
                        }
                    })


                    for (let openingOrderLine of newOpeningOrderLines) {
                        let priceLineId = chartSeriesRef.current?.createPriceLine(openingOrderLine)
                        openingOrderLines.current.push({ priceLineId: priceLineId!, priceLine: openingOrderLine })
                    }
                }

                tradingHost.subscribeEvent<Order>(eventSubScriberId, OrderUpdateEvent, (order: Order) => {

                    if (order.status === OrderStatus.CLOSED) {
                        let openedOrderLine = openingOrderLines.current.find((line) => { return line.priceLine.id === order.orderId })
                        if (openedOrderLine) {
                            chartSeriesRef.current?.removePriceLine(openedOrderLine.priceLineId)
                            openingOrderLines.current = openingOrderLines.current.filter((line) => { return line.priceLineId !== openedOrderLine.priceLineId })
                        }
                    } else {
                        let openedOrderLine = openingOrderLines.current.find((line) => { return line.priceLine.id === order.orderId })
                        if (!openedOrderLine) {

                            let newOrderLine: CreatePriceLineOptions = {
                                id: order.orderId,
                                price: order.executedPrice ?? 0,
                                title: `${order.orderId} ${order.side} ${order.quantity}`,
                                color: "green",
                                lineWidth: 2,
                                lineStyle: 2, // LineStyle.Dashed
                                axisLabelVisible: true,
                            }
                            const priceLineId = chartSeriesRef.current?.createPriceLine(newOrderLine)
                            openingOrderLines.current.push({ priceLineId: priceLineId!, priceLine: newOrderLine })
                        }
                    }
                    // setSymbolId(symbolId)
                })
            }
        }
        fetchData()

        return () => {
            const priceLines = chartSeriesRef.current?.priceLines()
            if (priceLines) {
                priceLines.forEach((line) => {
                    chartSeriesRef.current?.removePriceLine(line)
                })
            }

            openingOrderLines.current = []
            if (tradingHost && account) tradingHost.releaseEvent(eventSubScriberId, OrderUpdateEvent)
        }
    }, [account])



    const onResolutionChange = useCallback(async (resolution: Resolution) => {
        if (symbol && chartRef.current && chartSeriesRef.current && dataFeedAPI) {
            const bars = await dataFeedAPI.getBars(symbol.symbolId, resolution, props.chartType)
            chartSeriesRef.current.setData(bars)
            chartRef.current.timeScale().fitContent();
        }
    }, [])



    const onOrderCreate = async (order: Omit<Order, "opentime" | "symbol" | "quantity" | "currentQuote">) => {
        if (symbol && account && brokerAPI) {

        }
    }


    const onAlertAddBtnClick = () => {

    }

    const onIndicatorsAddBtnClick = () => {

    }

    const onNewOrderCreateBtnClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {

        disappearChartDialogs([chartMainDialogId])
        setOrderCreationDialogState({ display: "block", pointerX: event.clientX, pointerY: event.clientY })
    }


    return <div style={{
        height: "100%",
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
    }}>
        {


            <BidAskContext.Provider value={spread}>

                <OHLCContext.Provider value={olhc}>
                    <div style={{ zIndex: 7, width: "100%", height: "100%", background: "black", display: symbol === undefined ? "block" : "none", position: "absolute", color: "white" }}>Welcome</div>
                    <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 2 }}>
                        <SpreadOperator ref={lotSizRef}
                        ></SpreadOperator>
                    </div>
                    <div style={{ height: "calc(100% - 50px)", width: "100%", zIndex: 1, position: "relative", }}>

                        <DragbleComponent props={{
                            onClose: () => {
                                disappearChartDialogs([chartMainDialogId])
                            }, zIndex: 4, isDragable: false, display: chartMainDialogState.display, pointerX: chartMainDialogState.pointerX, pointerY: chartMainDialogState.pointerY, minX: 0, maxY: chartRef.current?.paneSize().height ?? 0
                        }} >

                            <div>
                                <span style={{ fontSize: "large", fontWeight: "bold" }}>Trading </span>
                                <DialogContextBtn onClick={() => {
                                    onOrderCreate({
                                        side: Side.BUY,
                                        orderType: chartMainDialogState.buy === "LIMIT" ? OrderType.LIMIT : OrderType.STOP,
                                        stopPrice: chartMainDialogState.price,
                                        limitPrice: chartMainDialogState.price,
                                    })
                                    disappearChartDialogs([chartMainDialogId])

                                }}>BUY {chartMainDialogState.buy} {chartMainDialogState.price}</DialogContextBtn>
                                <DialogContextBtn onClick={() => {
                                    onOrderCreate({
                                        side: Side.SELL,
                                        orderType: chartMainDialogState.sell === "LIMIT" ? OrderType.STOP : OrderType.LIMIT,
                                        stopPrice: chartMainDialogState.price,
                                        limitPrice: chartMainDialogState.price,
                                    })
                                    disappearChartDialogs([chartMainDialogId])

                                }}>SELL {chartMainDialogState.sell} {chartMainDialogState.price}</DialogContextBtn>
                                <DialogContextBtn color="TODO" onClick={onNewOrderCreateBtnClick}>Create new order</DialogContextBtn>
                            </div>
                            --------------------

                            <div>
                                <span style={{ fontSize: "large", fontWeight: "bold" }}> Tools </span>
                                <DialogContextBtn onClick={onAlertAddBtnClick}> Add alert </DialogContextBtn>
                                <DialogContextBtn onClick={onIndicatorsAddBtnClick}> Add indicators</DialogContextBtn>
                            </div>
                            --------------------

                            <DialogContextBtn>
                                Setting
                            </DialogContextBtn>
                            --------------------

                            <DialogContextBtn>
                                Refresh
                            </DialogContextBtn>
                        </DragbleComponent>

                        <DragbleComponent props={{
                            onClose: () => {
                                disappearChartDialogs([chartTradingDialogId])
                            }, zIndex: 5, isDragable: false, display: chartTradingDialogState.display, pointerX: chartTradingDialogState.pointerX, pointerY: chartTradingDialogState.pointerY, minX: 0, maxY: chartRef.current?.paneSize().height ?? 0
                        }} >
                            <DialogContextBtn onClick={() => {
                                onOrderCreate({
                                    side: Side.BUY,
                                    orderType: chartMainDialogState.buy === "LIMIT" ? OrderType.LIMIT : OrderType.STOP,
                                    stopPrice: chartMainDialogState.price,
                                    limitPrice: chartMainDialogState.price,

                                });
                                disappearChartDialogs([chartTradingDialogId])
                            }}>BUY {chartTradingDialogState.buy} {chartTradingDialogState.price}</DialogContextBtn>
                            <DialogContextBtn onClick={() => {
                                onOrderCreate({
                                    side: Side.SELL,
                                    orderType: chartMainDialogState.sell === "LIMIT" ? OrderType.STOP : OrderType.LIMIT,
                                    stopPrice: chartMainDialogState.price,
                                    limitPrice: chartMainDialogState.price,

                                })
                                disappearChartDialogs([chartTradingDialogId])

                            }}>SELL {chartTradingDialogState.sell} {chartTradingDialogState.price}</DialogContextBtn>
                        </DragbleComponent>


                        <div style={{ backgroundColor: "yellow", height: 25, pointerEvents: "none", position: "absolute", zIndex: 5, display: chartTradingActionState.display, top: chartTradingActionState.position.y, left: chartTradingActionState.position.x }}>
                            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <div > <span style={{ fontSize: "larger", fontWeight: "bold", }}> + </span></div>
                                <div style={{ marginLeft: "5px" }} ><span> {chartTradingActionState.price}</span></div>
                            </div>
                        </div>

                        <OrderCreationDialog onClose={() => { disappearChartDialogs([chartOrderCreationDialogId]) }}
                            display={orderCreationDialogState.display} pointerX={orderCreationDialogState.pointerX} pointerY={orderCreationDialogState.pointerY} minX={0} maxY={chartRef.current?.paneSize().height ?? 0} >
                        </OrderCreationDialog>

                        <div id="chart" onContextMenu={(event) => onChartRightClick(event)} ref={chartContainerRef} style={{ height: "100%", width: "100%" }}>
                        </div>
                    </div >
                    <div style={{ height: "50px", padding: "0px 10px" }}>
                        <TerminalResolution defaultSelectedResolution={DEFAULT_RESOLUTION} onResolutionChange={onResolutionChange}></TerminalResolution>
                    </div>
                </OHLCContext.Provider>
            </BidAskContext.Provider >

        }
    </div >




}



export const FlexBox = styled.div<{ direction?: "row" | "column" }>(props => ({
    display: "flex",
    flexDirection: props.direction ? props.direction : "column"
}))

interface OrderCreationProps extends DynamicElement, PoppableZone, Closeable {
    brokerAPI?: BrokerAPI,
    symbol?: SymbolInfo,
    account?: Account,
    bidAsk?: BidAsk
}
// type OrderCreationProps = Spread & OLHC & { account: string, symbol: string, onOrderCreate: (order: Order) => void } & DynamicElement & PoppableZone
const OrderCreationDialog: React.FC<OrderCreationProps> = (props) => {

    const {
        symbol = useContext(SelectedSymbolContext),
        account = useContext(AccountContext),
        brokerAPI = useContext(BrokerAPIContext),
        bidAsk = useContext(BidAskContext)
    } = props


    const [selectedOrderType, setSelectedOrderType] = useState<string>("MARKET");
    const [volume, setVolume] = useState<number>(0.1)
    const [price, setPrice] = useState<number>(0)
    const [stopOrLimit, setStopOrLimit] = useState<string>("STOP")
    const [stopLoss, setStopLoss] = useState<number>(0)
    const [takeProfit, setTakeProfit] = useState<number>(0)
    const [isClient, setIsClient] = useState(false);




    useEffect(() => {
        // This code only runs on the client side
        setIsClient(true);
    }, []);



    const onOrdercreateBtnClick = (side: Side) => {
        if (!brokerAPI || !account || !symbol || !bidAsk) return
        if (selectedOrderType === "MARKET") {

            brokerAPI.placeOrder(account.accountId, {
                side: side,
                currentQuote: bidAsk,
                symbol: symbol.symbolId,
                orderType: OrderType.MARKET,
                opentime: new Date().valueOf(),
                quantity: volume
            })
        } else {
            brokerAPI.placeOrder(account.accountId, {
                side: side,
                currentQuote: bidAsk,
                symbol: symbol.symbolId,
                orderType: stopOrLimit === "STOP" ? OrderType.STOP : OrderType.LIMIT,
                opentime: new Date().valueOf(),
                quantity: volume,
                sl: stopLoss,
                tp: takeProfit,
                stopPrice: price,
                limitPrice: price
            })

        }
    }

    return (

        (isClient) ?
            createPortal(< DragbleComponent props={{ ...props as DynamicElement & PoppableZone & Closeable, isDragable: true }} >
                {
                    (account && symbol && bidAsk) ?
                        <>
                            <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                <span>Account </span>
                                <div style={{ marginLeft: "10px" }}><input value={`${account.accountId}-${account.name}`} disabled></input></div>
                            </FlexBox>
                            <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                <span>Symbol </span>
                                <div style={{ marginLeft: "10px" }}><input value={`${symbol.symbolId}-${symbol.name}`} disabled></input></div>
                            </FlexBox>
                            <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                <span>Volume </span>
                                <div style={{ marginLeft: "10px" }}><input value={volume} onChange={(event) => {
                                    setVolume(Number(event.target.value))
                                }} type="number"></input></div>
                            </FlexBox>
                            <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                <FlexBox direction="row">
                                    <span>Stop Loss</span>
                                    <div style={{ marginLeft: "3px" }}> <input type="number" value={stopLoss} onChange={(event) => {
                                        setStopLoss(Number(event.target.value))
                                    }}></input></div>
                                </FlexBox>
                                <FlexBox direction="row">
                                    <span>Take Profit</span>
                                    <div style={{ marginLeft: "3px" }}> <input type="number" value={takeProfit} onChange={(event) => {
                                        setTakeProfit(Number(event.target.value))
                                    }}></input></div>
                                </FlexBox>
                            </FlexBox>
                            <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                <span>Execution Type</span>
                                <div style={{ marginLeft: "10px" }}> <select id="dropdown" value={selectedOrderType} onChange={(event) => {
                                    setSelectedOrderType(event.target.value);
                                }}>
                                    <option value="MARKET" >MARKET</option>
                                    <option value="LIMIT/STOP">LIMIT/STOP</option>
                                </select></div>
                            </FlexBox>
                            {
                                selectedOrderType === "LIMIT/STOP" ?
                                    <>
                                        <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                            <span>Order Type</span>
                                            <div style={{ marginLeft: "10px" }}> <select id="dropdown" value={stopOrLimit} onChange={(event) => {
                                                setStopOrLimit(event.target.value);
                                            }}>
                                                <option value="STOP" >STOP</option>
                                                <option value="LIMIT">LIMIT</option>
                                            </select></div>
                                        </FlexBox>
                                        <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "start" }}>
                                            <span>Price</span>
                                            <div style={{ marginLeft: "10px" }}> <input type="number" value={price} onChange={(event) => {
                                                setPrice(Number(event.target.value))
                                            }} ></input></div>
                                        </FlexBox>
                                    </>
                                    :
                                    <></>
                            }

                            <FlexBox direction="row" style={{ marginTop: "5px", alignItems: "center" }}>
                                <div>
                                    <button onClick={() => onOrdercreateBtnClick(Side.BUY)} style={{ width: "70px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            {selectedOrderType === "MARKET" ? <span>{bidAsk.bid}</span> : <></>}
                                            <span>Buy</span>
                                        </div>
                                    </button>
                                </div>
                                <div style={{ marginLeft: "10px" }}>
                                    <button onClick={() => onOrdercreateBtnClick(Side.SELL)} style={{ width: "70px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            {selectedOrderType === "MARKET" ? <span>{bidAsk.ask}</span> : <></>}

                                            <span>Sell</span>
                                        </div>
                                    </button>
                                </div>
                            </FlexBox>
                        </>
                        :
                        <div><span>Account & Symbol was not provided</span></div>
                }

            </DragbleComponent >, document.body)
            :
            <></>
    )
}

export type PoppableZone = {
    minX: number,
    maxY: number
}
type Closeable = { onClose: () => void }
export const DragbleComponent = ({
    children, props
}: {
    children: React.ReactNode,
    props: { zIndex?: number, isDragable?: boolean, title?: string } & DynamicElement & PoppableZone & Closeable
}) => {
    const { zIndex = 3, isDragable = true, title = "" } = props
    const [position, setPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
    const [width, setWidth] = useState<number | undefined>();
    const [height, setHeight] = useState<number | undefined>();
    const observedDiv = useRef<HTMLDivElement>(null);
    const resizeObserver = useRef<ResizeObserver>(null)


    const [isDragging, setDragging] = useState(false);
    const frameID = useRef(0);
    const lastX = useRef(0);
    const lastY = useRef(0);
    const dragX = useRef(0);
    const dragY = useRef(0);


    const handleMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent> | MouseEvent) => {
        if (!isDragable) return
        if (!isDragging) {
            return;
        }

        if (typeof window !== undefined) {
            const deltaX = lastX.current - e.pageX;
            const deltaY = lastY.current - e.pageY;
            lastX.current = e.pageX;
            lastY.current = e.pageY;
            dragX.current -= deltaX;
            dragY.current -= deltaY;

            window.cancelAnimationFrame(frameID.current);
            frameID.current = window.requestAnimationFrame(() => {
                if (observedDiv.current) observedDiv.current.style.transform = `translate3d(${dragX.current}px, ${dragY.current}px, 0)`;

            });
        }

    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (!isDragable) return
        lastX.current = e.pageX;
        lastY.current = e.pageY;
        setDragging(true);
    };

    const handleMouseUp = () => {
        if (!isDragable) return
        setDragging(false);
    };

    /**
     *
     */
    useEffect(() => {
        if (!isDragable) return
        observedDiv.current?.addEventListener('mousemove', handleMove);
        observedDiv.current?.addEventListener('mouseup', handleMouseUp);

        return () => {
            observedDiv.current?.removeEventListener('mousemove', handleMove);
            observedDiv.current?.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const [isInitialized, setIsInitialized] = useState<boolean>(false)
    useEffect(() => {

        if (props.display === "block") {
            if (!observedDiv.current) {
                return;
            }

            resizeObserver.current = new ResizeObserver(() => {
                if (observedDiv.current?.offsetWidth !== width) { // HERE
                    setWidth(observedDiv.current?.offsetWidth);
                }
                if (observedDiv.current?.offsetHeight !== height) { //HERE
                    setHeight(observedDiv.current?.offsetHeight);
                }
            });
            resizeObserver.current.observe(observedDiv.current);

        }
        return function cleanup() {
            if (resizeObserver.current) resizeObserver.current.disconnect();
            observedDiv.current?.removeEventListener('mousemove', handleMove);
            observedDiv.current?.removeEventListener('mouseup', handleMouseUp);
        }

    }, [
        props.display
    ])

    useEffect(() => {
        if (!observedDiv.current || props.display === "none") {
            return;
        }
        if (!width && !height) {
            return
        }
        if (!isInitialized) {
            setIsInitialized(true)
        } else {

        }

    }, [width, height])

    useEffect(() => {


        if (isInitialized) {

            const { x, y } = calculateAppropirateXY(width ?? 0, height ?? 0, props.pointerX, props.pointerY, props.maxY, 0)
            setPosition({ x: x, y: y })
        }
    }, [isInitialized])
    useEffect(() => {


        if (isInitialized) {
            const { x, y } = calculateAppropirateXY(width ?? 0, height ?? 0, props.pointerX, props.pointerY, props.maxY, 0)
            setPosition({ x: x, y: y })
        }
    }, [props.pointerX, props.pointerY])

    const onClose = () => {
        props.onClose()
    }

    return (
        <div ref={observedDiv}

            style={{ display: props.display, position: "absolute", top: position.y, left: position.x, zIndex: zIndex, padding: "10px", background: "white", border: "1px solid grey" }}>
            <FlexBox direction="row"
                onMouseDown={handleMouseDown}
                style={{ justifyContent: "space-between", height: "20px", alignItems: "center", cursor: isDragable ? "move" : "", }}>
                <div style={{ fontSize: "larger", fontWeight: "bold" }}>{title}</div><div onClick={() => {
                    onClose()
                }} style={{ fontSize: "larger", cursor: "pointer" }}>X</div>
            </FlexBox>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", }}>
                {children}
            </div>
        </div>
    )
}

export type BidAsk = { bid: number, ask: number }
export type OLHC = { open: number, close: number, low: number, high: number }

// onOrderCreate: (type: Side) => void

interface SpreadOperatorProps {

}
const SpreadOperator = memo(forwardRef<HTMLInputElement, SpreadOperatorProps>((props, ref) => {


    const bidAsk = useContext(BidAskContext)
    const ohlc = useContext(OHLCContext)
    const currentAccount = useContext(AccountContext)
    const brokerAPI = useContext(BrokerAPIContext)
    const selectedSymbol = useContext(SelectedSymbolContext)

    const [volume, setVolume] = useState<number>(0.1)
    const onOrderCreate = (side: Side) => {
        if (!currentAccount || !brokerAPI || !selectedSymbol || !bidAsk) return
        brokerAPI.placeOrder(currentAccount.accountId, {
            symbol: selectedSymbol.symbolId,
            quantity: volume,
            side: side,
            orderType: OrderType.MARKET,
            currentQuote: bidAsk,
            opentime: new Date().valueOf()
        })

    }

    useEffect(() => {

        return () => {

        }

    }, [])



    return <div>
        {
            (bidAsk && ohlc) ? <>
                < div style={{ display: "flex", flexDirection: "row" }} >
                    <button disabled={currentAccount === undefined ? true : false} onClick={() => { onOrderCreate(Side.BUY) }} style={{ height: "70px", width: "100px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span>{bidAsk.ask}</span>
                            <span>Buy</span>
                        </div>
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-around" }}>
                        <span>
                            {Math.abs(bidAsk.ask - bidAsk.bid).toFixed(2)}
                        </span>
                        <div style={{ padding: "0px 10px" }}>
                            <input style={{ width: "50px" }} value={volume} ref={ref} onChange={(e) => { setVolume(Number(e.target.value)) }} type="number" />
                        </div>
                    </div>

                    <button disabled={currentAccount === undefined ? true : false} onClick={() => { onOrderCreate(Side.SELL) }} style={{ height: "70px", width: "100px" }} >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span>{bidAsk.bid}</span>
                            <span>Sell</span>
                        </div>
                    </button>

                </div >
                <div style={{ display: "flex", flexDirection: "row", marginTop: "10px" }}>
                    <span>O : {ohlc.open} - H : {ohlc.close} - L : {ohlc.low} - C : {ohlc.close}</span>
                </div>
            </> : <></>
        }
    </div >

})
)
interface TerminalResolutionProps {
    defaultSelectedResolution: Resolution,
    onResolutionChange: (resoution: Resolution) => void
}
const TerminalResolution = memo(((props: TerminalResolutionProps) => {
    const [utcTime, setUTCTime] = useState<string>("UTC....")
    const [selectedResolution, setSelectedResolution] = useState<Resolution>(props.defaultSelectedResolution)
    useEffect(() => {
        const interval = setInterval(() => {
            const date = new Date()
            setUTCTime(`UTC : ${date.getHours()}:${date.getMinutes()}${date.getSeconds()}`)
        }, 1000)
        return () => {
            clearInterval(interval)
        }
    }, [])

    const onResolutionChange = (resolution: Resolution) => {
        props.onResolutionChange(resolution)
        setSelectedResolution(resolution)
    }
    return <div style={{ display: "flex", flexDirection: "row", alignItems: "center", height: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "row" }}>
            {
                RESOLUTIONS.map((resolution) => {
                    return <div key={resolution.range} style={{ padding: "7px", cursor: "pointer", background: resolution.range === selectedResolution.range ? "grey" : "" }} onClick={() => {
                        onResolutionChange(resolution)
                    }}>{resolution.range}</div>
                })
            }
        </div>
        <div >
            {utcTime.toLocaleString()}
        </div>
    </div>
}))



interface VResizerComponentProps {
    c1Height: string,
    c2Height: string,
}


const VResizerComponent = ({
    child1, child2, props,
}: {
    child1: React.ReactNode,
    child2: React.ReactNode,
    props: VResizerComponentProps
}) => {

    const child1Ref = useRef<HTMLDivElement>(null)
    const child2Ref = useRef<HTMLDivElement>(null)
    const [isDragging, setDragging] = useState(false);
    const dragger = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const handleMove = (e: MouseEvent) => {
        console.log("started mouse move")

        if (!isDragging) {
            return;
        }

        if (typeof window !== undefined && parentRef.current && dragger.current && child1Ref.current && child2Ref.current) {
            console.log(e)
            const parentHeight = parentRef.current.clientHeight
            if (e.layerY > 50 && (parentHeight - e.layerY) > 50) {
                const c2Height = parentHeight - e.layerY
                const c1Height = parentHeight - c2Height
                child1Ref.current.style.height = `${c1Height - 2}px`
                child2Ref.current.style.height = `${c2Height - 2}px`
            }

        }

    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        console.log("Moused Down")
        setDragging(true);
    };

    const handleMouseUp = () => {
        console.log("Moused Up")
        setDragging(false);
    };

    /**
     *
     */
    useEffect(() => {


        parentRef.current?.addEventListener('mousemove', handleMove);
        parentRef.current?.addEventListener('mouseup', handleMouseUp);
        return () => {

            parentRef.current?.removeEventListener('mousemove', handleMove);
            parentRef.current?.removeEventListener('mouseup', handleMouseUp);


        };
    }, [isDragging]);

    return <div ref={parentRef} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div ref={child1Ref} style={{ height: `calc(${props.c1Height} - 2px)` }}>
            {child1}
        </div>
        <div onMouseDown={handleMouseDown} ref={dragger} style={{ height: "4px", cursor: "row-resize", border: "1px solid grey" }}></div>
        <div ref={child2Ref} style={{
            height: `calc(${props.c2Height} - 2px)`
        }}>
            {child2}
        </div>

    </div>
}




interface TradingTerminalProps extends ChartProps, AccountManagerProps { }


export const TradingTerminal: React.FC<TradingTerminalProps> = (props) => {
    return <VResizerComponent
        child1={<Chart props={{ ...props }}></Chart>}
        child2={<AccountManager props={{ ...props }}></AccountManager>} props={{ c1Height: "70%", c2Height: "30%" }}

    ></VResizerComponent >
}

export default SystemManager