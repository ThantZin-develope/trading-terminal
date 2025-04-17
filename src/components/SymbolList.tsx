import { useContext } from "react";
import { SymbolInfo, Theme } from "../apis/api";
import { SymbolsContext, ThemeContext } from "./TradingTerminal";
import React from "react";

interface SymbolListProps {
    theme?: Theme,
    onSymbolSelected: (symbol: SymbolInfo) => void
}

const SymbolList: React.FC<SymbolListProps> = (props) => {
    // TODO: theme
    const { theme = useContext(ThemeContext) } = props

    const onSymbolSelect = (symbolId: string) => {
        const symbol = symbols.find((e) => { return e.symbolId === symbolId })
        if (symbol !== undefined) {
            props.onSymbolSelected(symbol)
        }
    }
    const symbols = useContext(SymbolsContext)
    return <select style={{ height: "100%", width: "100%" }} defaultValue={""} onChange={(e) => { onSymbolSelect(e.target.value) }}>
        <option value={""} >Please select symbol</option>
        {
            symbols.map((e, i) => {
                return <option value={e.symbolId} key={i}>{e.name} : {e.name}</option>
            })
        }
    </select>
}

export default SymbolList