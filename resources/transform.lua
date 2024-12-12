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
    --[[
local function separateTableRecursive(inputTable, name, seen)
    -- Track visited tables to handle recursion
    seen = seen or {}
    if seen[inputTable] then
        return nil
    end
    seen[inputTable] = true
    name = name or "Recursive Table"

    local keyValues = {}
    local values = {}

    for k, v in pairs(inputTable) do
        local valueType = type(v)
        
        if valueType == "table" then
            -- Handle nested tables recursively
            local nestedKey = type(k) == "string" and k or "Nested Table"
            local nestedTable = separateTableRecursive(v, nestedKey, seen)

            if nestedTable then
                values[nestedKey] = nestedTable
            else
                keyValues[k] = v
            end

        elseif valueType == "function" then
            -- Store function names as keys
            local funcName = debug.getinfo(v, "n").name or "Unnamed Function"
            values[funcName] = v

        elseif valueType == "userdata" then
            -- For userdata, you can treat it as a string or some other type of value
              -- Convert userdata to string representation (or modify this as per your use case)

        else
            -- For other types (number, string, boolean, etc.)
            keyValues[k] = v
        end
    end

    -- Return the result based on which sections are populated
    if #keyValues > 0 and #values > 0 then
        return {keyValues, values}
    elseif #keyValues > 0 then
        return keyValues
    elseif #values > 0 then
        return values
    else
        return nil
    end
end
    --]]
local function flatten_mixed_table(input_table, table_name)
  local output_table = {}
  local visited = {}

  local function flatten_recursive(table_part, prefix)
    if visited[table_part] then
      output_table[prefix .. "[CIRCULAR REFERENCE]"] = nil
      return
    end

    visited[table_part] = true

    for k, v in pairs(table_part) do
      if type(v) == "userdata" then
        goto continue
      end

      local new_key = prefix

      if type(k) == "number" then
        new_key = new_key
      else
        new_key = new_key .. tostring(k)
      end

      if type(v) == "table" then
        flatten_recursive(v, new_key .. ".")
      elseif type(v) == "function" then
        output_table[new_key] = tostring(v)
      else
        output_table[new_key] = v
      end

      ::continue::
    end
    visited[table_part] = nil
  end

    local initial_prefix = ""
    if table_name then
        initial_prefix = table_name .. "."
    end

  flatten_recursive(input_table, initial_prefix)
  return output_table
end


-- Exported function
function transform.separateTable(inputTable, name)
    return flatten_mixed_table(inputTable, name)
end

-- Return the module
return transform
