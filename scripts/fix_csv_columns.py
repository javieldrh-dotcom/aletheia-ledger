import pandas as pd

df = pd.read_csv("test-data/koi-4878-real-kepler.csv")

# Elimina la columna indice duplicada si existe (columna sin nombre
# util, resultado de que el indice de pandas tambien se llamaba "time")
if df.columns[0] != "time":
    df = df.drop(columns=[df.columns[0]])

df.to_csv("test-data/koi-4878-real-kepler.csv", index=False)
print("Corregido.")
print(df.head())
print(f"Total filas: {len(df)}")