import { useContext, useEffect, useRef, useState } from "react";
import useHighestZIndex from "../hooks/useHighestZIndex";
import { DataFeedAPI, SymbolInfo } from "../apis/api";
import { BidAsk, DataFeedAPIContext, FlexBox, SymbolsContext } from "./TradingTerminal";
import { DataTable } from "./AccountManager";

import { v4 as uuidv4 } from 'uuid';
import React from "react";
interface WatchListProps {
    dataFeedAPI?: DataFeedAPI
}

const WatchList: React.FC<WatchListProps> = (props) => {

    const { dataFeedAPI = useContext(DataFeedAPIContext) } = props
    const contextSymbols = useContext(SymbolsContext)
    const parentDiv = useRef<HTMLDivElement>(null)
    const resizeObserver = useRef<ResizeObserver>(null)

    const [parentDivSize, setParentDivSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 })

    const [symbols, setSymbols] = useState<SymbolInfo[]>([])





    useEffect(() => {
        if (contextSymbols.length > 0) {
            debugger
            setSymbols([...contextSymbols])
        }
    }, [contextSymbols])

    // const [watchUpdate, setWatchUpdate] = useState<{ symbolId: string, bid: number, ask: number }>()

  



    useEffect(() => {
        if (symbols.length == 0 || !dataFeedAPI) return


        return () => {
         
        }


    }, [symbols, dataFeedAPI])


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
    return <FlexBox style={{ height: "100%" }}>
        <div style={{ height: "25px" }}>Market Watch</div>
        <div style={{ height: "calc(100% - 32px)", marginTop: "7px" }}>
            <DataTable bodyheight={parentDivSize.height - 57} style={{ width: "100%" }}>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Bid</th>
                        <th>Ask</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        symbols.map((e, i) => {
                            return <SymbolComp key={i} symbol={e}></SymbolComp>
                        })
                    }
                </tbody>
            </DataTable>
        </div>
    </FlexBox>
}

interface SymbolCompProps {
    dataFeedAPI?: DataFeedAPI,
    symbol: SymbolInfo
}

const SymbolComp : React.FC<SymbolCompProps> = (props) => {

    const {dataFeedAPI = useContext(DataFeedAPIContext)} = props

    const [bidAsk, setBidAsk ] = useState<{bidAsk : BidAsk , up: number}>({bidAsk: {bid: 0 , ask: 0}, up: 1})
    useEffect(() => {} , [])

    useEffect(() => {

        let subscriptionId = ""
        if(dataFeedAPI && props.symbol){
            subscriptionId = uuidv4()
            dataFeedAPI.subScribeQutoe(props.symbol.symbolId , (data) => {

                let newBidAsk = { bidAsk : { bid : data.bidAsk.bid , ask : data.bidAsk.ask} , up : data.bidAsk.bid >= bidAsk.bidAsk.bid ? 1 : 0}
                setBidAsk(newBidAsk)
            } , subscriptionId)
        }
        return () => {
            if(subscriptionId){
                dataFeedAPI?.unSubscribeQuote(subscriptionId)
            }
        }
    } , [dataFeedAPI , props.symbol])
    return <tr>
        <td>
        <FlexBox direction="row">
        <span style={{ fontWeight: "bold", color: bidAsk.up == 1 ? "green" : "red" }}>{bidAsk.up == 1 ? "↑" : "↓"}</span>  <span style={{ marginLeft: "7px" }}>{props.symbol.name}</span>
        </FlexBox>
        </td>
        <td>
            { bidAsk.bidAsk.bid}
        </td>
        <td>
            {bidAsk.bidAsk.ask}
        </td>
        </tr>
}


export const DragbleComponent2 = ({
    children
}: {
    children: React.ReactNode,

}) => {


    const observedDiv = useRef<HTMLDivElement>(null);
    // const resizeObserver = useRef<ResizeObserver>(null)

    const zIndex = useHighestZIndex()
    console.log("highest zIndex ", zIndex)
    const [isDragging, setDragging] = useState(false);
    const frameID = useRef(0);
    const lastX = useRef(0);
    const lastY = useRef(0);
    const dragX = useRef(0);
    const dragY = useRef(0);


    const handleMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent> | MouseEvent) => {
        if (!isDragging) {
            return;
        }

        if (typeof window !== undefined) {
            debugger
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
        lastX.current = e.pageX;
        lastY.current = e.pageY;
        setDragging(true);
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    /**
     *
     */
    useEffect(() => {
        if (!isDragging || !observedDiv.current) return
        observedDiv.current.addEventListener('mousemove', handleMove);
        observedDiv.current.addEventListener('mouseup', handleMouseUp);

        return () => {
            observedDiv.current?.removeEventListener('mousemove', handleMove);
            observedDiv.current?.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    useEffect(() => {

        if (observedDiv.current) {
            // if (!observedDiv.current) {
            //     return;
            // }

            // resizeObserver.current = new ResizeObserver(() => {
            //     if (observedDiv.current?.offsetWidth !== width) { // HERE
            //         setWidth(observedDiv.current?.offsetWidth);
            //     }
            //     if (observedDiv.current?.offsetHeight !== height) { //HERE
            //         setHeight(observedDiv.current?.offsetHeight);
            //     }
            // });
            // resizeObserver.current.observe(observedDiv.current);

        }
        return function cleanup() {
            // if (resizeObserver.current) resizeObserver.current.disconnect();
            // observedDiv.current?.removeEventListener('mousemove', handleMove);
            // observedDiv.current?.removeEventListener('mouseup', handleMouseUp);
        }

    }, [
        observedDiv.current
    ])

    return (
        <div ref={observedDiv}
            onMouseDown={handleMouseDown}
            style={{ position: "absolute", zIndex: zIndex, cursor: "move", width: "100%", height: "100%" }}>

            {children}
        </div>
    )
}

export default WatchList