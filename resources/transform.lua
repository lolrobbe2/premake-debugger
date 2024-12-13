local transform = {}

-- Function to check if a table is mixed
local function isMixedTable(inputTable)
    local keyType, valueType
    for k, v in pairs(inputTable) do
        local currentKeyType = type(k)
        local currentValueType = type(v)

        -- If either the key or value is a function, consider the table mixed
        if currentKeyType == "function" or currentValueType == "function" then
            return true
        end

        -- Check if the key types are mixed
        if not keyType then
            keyType = currentKeyType
        elseif keyType ~= currentKeyType then
            return true -- Found mixed key types
        end

        -- Check if the value types are mixed
        if not valueType then
            valueType = currentValueType
        elseif currentValueType ~= "table" and valueType ~= "table" and valueType ~= currentValueType then
            return true -- Found mixed value types (excluding nested tables)
        end
    end
    return false
end


-- Helper function to handle userdata
local function handleUserdata(value)
    if type(value) == "userdata" then
        -- Check if userdata can be treated as a table or array
        -- Some userdata types can be converted to tables/arrays, others cannot
        -- If it can be treated as a table, do so. Otherwise, use tostring().
        if getmetatable(value) then
            -- If userdata has a metatable, you can try to access it as a table-like structure
            return { tostring(value), meta = getmetatable(value) }
        else
            -- If userdata doesn't have a metatable, fall back to tostring
            return tostring(value)
        end
    end
    return value
end

-- Helper function to handle functions
local function handleFunctionName(value)
    if type(value) == "function" then
        -- If it's a function, use the function's name or default to "Unnamed Function"
        local name = debug.getinfo(value, "n").name or "Unnamed Function"
        return name
    end
    return value
end

local function handleFunctionValue(value)
    if type(value) == "function" then
        -- If it's a function, use the function's name or default to "Unnamed Function"
        return tostring(name)
    end
    return value
end

-- Recursive function to separate a mixed table

local function separateTableRecursive(inputTable, seen)
    local keyValues = {}
    local values = {}

    for k, v in pairs(inputTable) do
        local valueType = type(v)
        local keyToUse = k

        if type(k) == "number" then
            keyToUse = tostring(k)
        end

        if valueType == "table" then
            values[keyToUse] = tostring(v) -- Store "table" as a string
        elseif valueType == "function" then
            local funcName = debug.getinfo(v, "n").name
            if funcName then
                values[keyToUse] = funcName
            end
        elseif valueType == "userdata" then
            local mt = getmetatable(v)
            if mt and mt.__name then
                values[keyToUse] = mt.__name
            end
        else
            keyValues[keyToUse] = v
        end
    end

    if next(keyValues) and next(values) then
        return { keyValues = keyValues, values = values }
    elseif next(keyValues) then
        return keyValues
    elseif next(values) then
        return values
    else
        return nil
    end
end
   

function transform.tablelength(table)
   local count = 0
   for _ in pairs(table) do count = count + 1 end
   return count
end
-- Exported function
function transform.separateTable(inputTable, name)
    return separateTableRecursive(inputTable, name)
end

-- Return the module
return transform
